"""API-level checks for Redis-backed response caching."""

import pytest
from fakeredis import aioredis
from fastapi import FastAPI, Request
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend
from fastapi_cache.backends.redis import RedisBackend
from fastapi_cache.decorator import cache
from httpx import ASGITransport, AsyncClient

from lcfs.services.redis.coder import RedisJsonCoder


@pytest.mark.anyio
async def test_cached_api_response_is_reused_from_redis():
    """A second request for the same route returns the cached response."""
    # Production config decodes Redis responses to strings for application code.
    redis_client = aioredis.FakeRedis(decode_responses=True)
    app = FastAPI()
    calls = 0

    # Simulate a prior test initializing the process-wide cache singleton.
    FastAPICache.init(InMemoryBackend(), prefix="preinitialized-test-cache")
    FastAPICache.reset()
    FastAPICache.init(
        RedisBackend(redis_client), prefix="redis-api-test", coder=RedisJsonCoder
    )
    assert isinstance(FastAPICache.get_backend(), RedisBackend)
    assert FastAPICache.get_coder() is RedisJsonCoder

    @app.get("/cached-value")
    @cache(expire=60)
    async def get_cached_value(request: Request):
        nonlocal calls
        calls += 1
        return {"calls": calls}

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            first = await client.get("/cached-value")
            second = await client.get("/cached-value")

        assert first.status_code == second.status_code == 200
        assert first.json() == second.json() == {"calls": 1}
        assert calls == 1
    finally:
        FastAPICache.reset()
        await redis_client.close()
