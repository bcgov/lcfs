"""Tests for the Redis-backed rate limiter."""

import pytest
from fakeredis import FakeServer, aioredis
from fastapi import FastAPI, Request
from httpx import AsyncClient
from starlette.requests import Request as StarletteRequest

from lcfs.settings import settings
from lcfs.web.core.rate_limit import (
    RATE_LIMIT_EXEMPT,
    RateLimit,
    client_ip,
    enforce_rate_limit,
)
from lcfs.web.core.decorators import public_view_handler


def _make_request(app: FastAPI, peer: str = "1.2.3.4", headers=None) -> Request:
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/test",
        "raw_path": b"/api/test",
        "query_string": b"",
        "headers": [
            (k.lower().encode(), v.encode()) for k, v in (headers or {}).items()
        ],
        "client": (peer, 12345),
        "app": app,
        "route": None,
        "user": None,
        "state": {},
    }
    request = StarletteRequest(scope)
    return request


@pytest.fixture
async def app_with_redis():
    server = FakeServer()
    server.connected = True
    redis_client = aioredis.FakeRedis(server=server, decode_responses=True)
    app = FastAPI()
    app.state.redis_client = redis_client
    try:
        yield app, redis_client
    finally:
        await redis_client.close()


@pytest.mark.anyio
async def test_enforce_rate_limit_allows_under_cap(app_with_redis):
    app, _ = app_with_redis
    limit = RateLimit(times=3, seconds=60, bucket="t1")
    for _ in range(3):
        await enforce_rate_limit(_make_request(app), limit)


@pytest.mark.anyio
async def test_enforce_rate_limit_blocks_over_cap(app_with_redis):
    from fastapi import HTTPException

    app, _ = app_with_redis
    limit = RateLimit(times=2, seconds=60, bucket="t2")
    await enforce_rate_limit(_make_request(app), limit)
    await enforce_rate_limit(_make_request(app), limit)
    with pytest.raises(HTTPException) as exc_info:
        await enforce_rate_limit(_make_request(app), limit)

    assert exc_info.value.status_code == 429
    assert "Retry-After" in exc_info.value.headers
    assert int(exc_info.value.headers["Retry-After"]) >= 1


@pytest.mark.anyio
async def test_enforce_rate_limit_isolates_by_ip(app_with_redis):
    app, _ = app_with_redis
    limit = RateLimit(times=1, seconds=60, bucket="t3")
    await enforce_rate_limit(_make_request(app, peer="10.0.0.1"), limit)
    # Different IP gets its own counter.
    await enforce_rate_limit(_make_request(app, peer="10.0.0.2"), limit)


@pytest.mark.anyio
async def test_enforce_rate_limit_disabled(monkeypatch, app_with_redis):
    app, _ = app_with_redis
    monkeypatch.setattr(settings, "rate_limit_enabled", False)
    limit = RateLimit(times=1, seconds=60, bucket="t4")
    # Should never raise regardless of how many calls.
    for _ in range(5):
        await enforce_rate_limit(_make_request(app), limit)


@pytest.mark.anyio
async def test_enforce_rate_limit_no_redis_is_best_effort():
    app = FastAPI()
    # No redis_client on app.state -> should silently pass through.
    await enforce_rate_limit(_make_request(app), RateLimit(times=1, seconds=60))


def test_client_ip_ignores_forwarded_when_proxy_not_trusted(monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_trusted_proxies", "")
    app = FastAPI()
    req = _make_request(
        app, peer="203.0.113.5", headers={"x-forwarded-for": "9.9.9.9, 1.1.1.1"}
    )
    assert client_ip(req) == "203.0.113.5"


def test_client_ip_honours_forwarded_when_proxy_trusted(monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_trusted_proxies", "10.0.0.0/8")
    app = FastAPI()
    req = _make_request(
        app, peer="10.1.2.3", headers={"x-forwarded-for": "9.9.9.9, 10.1.2.3"}
    )
    assert client_ip(req) == "9.9.9.9"


@pytest.mark.anyio
async def test_public_view_handler_rate_limit_override(app_with_redis):
    from fastapi import HTTPException

    app, _ = app_with_redis

    @public_view_handler(rate_limit=RateLimit(times=1, seconds=60, bucket="pv1"))
    async def handler(request):
        return "ok"

    assert await handler(_make_request(app)) == "ok"
    with pytest.raises(HTTPException) as exc_info:
        await handler(_make_request(app))
    assert exc_info.value.status_code == 429


@pytest.mark.anyio
async def test_public_view_handler_exempt_skips_limit(monkeypatch, app_with_redis):
    app, _ = app_with_redis
    monkeypatch.setattr(settings, "rate_limit_default_times", 1)
    monkeypatch.setattr(settings, "rate_limit_default_seconds", 60)

    @public_view_handler(rate_limit=RATE_LIMIT_EXEMPT)
    async def handler(request):
        return "ok"

    # Many calls, no limiter applied.
    for _ in range(5):
        assert await handler(_make_request(app)) == "ok"
