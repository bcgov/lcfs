"""Redis-backed rate limiting for FastAPI routes.

Provides a shared, replica-safe fixed-window rate limiter that uses the
application's existing Redis client. It is designed to plug into the
``public_view_handler`` decorator so public endpoints get a sensible
global cap, with per-route overrides available via the ``rate_limit``
argument.

The implementation intentionally uses a simple ``INCR`` + ``EXPIRE``
fixed-window counter on Redis so that limits are shared across every
FastAPI replica (e.g. multiple OpenShift pods) without requiring any
new infrastructure.
"""

from __future__ import annotations

import ipaddress
import time
from dataclasses import dataclass
from typing import Iterable, List, Optional

import structlog
from fastapi import HTTPException, Request, status
from redis.asyncio import Redis

from lcfs.settings import settings

logger = structlog.get_logger(__name__)

# Sentinel used to opt a route out of rate limiting entirely.
RATE_LIMIT_EXEMPT = "exempt"


@dataclass(frozen=True)
class RateLimit:
    """A simple fixed-window rate limit.

    :param times: Maximum number of requests allowed per window.
    :param seconds: Window size, in seconds.
    :param bucket: Optional bucket name. Defaults to the matched route
        path so each endpoint gets its own counter.
    :param scope: Either ``"ip"`` (default) or ``"user"``. When
        ``"user"`` is used and the request is authenticated, the limit
        is keyed on the user's id; it falls back to IP for anonymous
        callers.
    """

    times: int
    seconds: int
    bucket: Optional[str] = None
    scope: str = "ip"


def _default_limit() -> RateLimit:
    return RateLimit(
        times=settings.rate_limit_default_times,
        seconds=settings.rate_limit_default_seconds,
    )


def _parse_trusted_proxies(raw: str) -> List[ipaddress._BaseNetwork]:
    networks: List[ipaddress._BaseNetwork] = []
    for chunk in (raw or "").split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        try:
            networks.append(ipaddress.ip_network(chunk, strict=False))
        except ValueError:
            logger.warning("Ignoring invalid trusted proxy entry", entry=chunk)
    return networks


def _is_trusted(client_ip_str: str, trusted: Iterable[ipaddress._BaseNetwork]) -> bool:
    try:
        addr = ipaddress.ip_address(client_ip_str)
    except ValueError:
        return False
    return any(addr in net for net in trusted)


def client_ip(request: Request) -> str:
    """Resolve the originating client IP for rate-limiting purposes.

    ``X-Forwarded-For`` is honoured only when the direct peer is in the
    configured trusted-proxy list (``LCFS_RATE_LIMIT_TRUSTED_PROXIES``).
    Otherwise the direct connection peer address is used. This prevents
    anonymous callers from spoofing their IP via forwarded headers.
    """
    peer = request.client.host if request.client else "unknown"
    trusted = _parse_trusted_proxies(settings.rate_limit_trusted_proxies)
    if trusted and _is_trusted(peer, trusted):
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            # Left-most entry is the originating client per RFC 7239 conventions.
            candidate = forwarded.split(",")[0].strip()
            if candidate:
                return candidate
    return peer


def _identifier(request: Request, scope: str) -> str:
    if scope == "user":
        user = getattr(request, "user", None)
        user_id = getattr(user, "user_profile_id", None) if user is not None else None
        if user_id:
            return f"user:{user_id}"
    return f"ip:{client_ip(request)}"


def _bucket(request: Request, cfg: RateLimit) -> str:
    if cfg.bucket:
        return cfg.bucket
    route = request.scope.get("route") if request.scope else None
    path = getattr(route, "path", None) or request.url.path
    return path


async def enforce_rate_limit(
    request: Request,
    limit: Optional[RateLimit] = None,
) -> None:
    """Enforce a rate limit for the current request.

    Reads the Redis client from ``request.app.state.redis_client`` and
    applies a fixed-window counter. If the limit is exceeded, raises
    HTTP 429 with a ``Retry-After`` header and a descriptive body.

    This is a best-effort limiter: if Redis is unavailable or errors,
    the request is allowed through and a warning is logged. The goal is
    to never take down the API because the limiter itself is degraded.
    """
    if not settings.rate_limit_enabled:
        return

    redis: Optional[Redis] = getattr(request.app.state, "redis_client", None)
    if redis is None:
        logger.debug("Rate limiter skipped: redis client unavailable")
        return

    cfg = limit or _default_limit()
    if cfg.times <= 0 or cfg.seconds <= 0:
        return

    window = int(time.time()) // cfg.seconds
    bucket = _bucket(request, cfg)
    ident = _identifier(request, cfg.scope)
    key = f"lcfs:ratelimit:{bucket}:{ident}:{window}"

    try:
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, cfg.seconds)
    except Exception as exc:  # pragma: no cover - never fail closed on redis errors
        logger.warning("Rate limit redis error; allowing request", error=str(exc))
        return

    if count > cfg.times:
        try:
            ttl = await redis.ttl(key)
        except Exception:  # pragma: no cover
            ttl = cfg.seconds
        retry_after = max(int(ttl), 1)
        logger.info(
            "Rate limit exceeded",
            bucket=bucket,
            identifier=ident,
            count=count,
            limit=cfg.times,
            window=cfg.seconds,
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Rate limit exceeded: {cfg.times} requests per "
                f"{cfg.seconds} seconds. Retry in {retry_after}s."
            ),
            headers={"Retry-After": str(retry_after)},
        )
