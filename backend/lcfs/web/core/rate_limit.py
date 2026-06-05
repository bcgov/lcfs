"""Redis-backed fixed-window rate limiter

Uses the Redis client (shared across all pods) via a simple
INCR/EXPIRE counter. Plugs into ``public_view_handler``; per-route
overrides are available via the ``rate_limit`` argument.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Optional

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


def client_ip(request: Request) -> str:
    """Resolve the originating client IP for rate-limiting purposes.

    Uvicorn is configured with ``--proxy-headers`` and
    ``--forwarded-allow-ips="*"`` (see ``lcfs.__main__``), which
    rewrites ``request.client.host`` to the left-most ``X-Forwarded-For``
    entry when the request arrives via the OpenShift router. Because
    LCFS pods are never directly reachable from the internet, that
    router is the only possible TCP peer, so we can trust the rewritten
    value without an additional CIDR allow-list here.
    """
    return request.client.host if request.client else "unknown"


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
    """Raise HTTP 429 if the request exceeds its fixed-window counter in Redis.

    Best-effort: Redis errors allow the request through rather than failing closed.
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
