from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from redis.exceptions import RedisError, TimeoutError
from starlette.requests import Request

from lcfs.services.redis.dependency import get_redis_client
from lcfs.services.redis.lifetime import init_redis, shutdown_redis


@pytest.mark.anyio
async def test_init_redis_success():
    """
    Test Redis initialization succeeds and pings the client.
    """
    app = FastAPI()
    mock_redis = AsyncMock()

    with patch("lcfs.services.redis.lifetime.Redis", return_value=mock_redis):
        # Mock Redis ping to simulate successful connection
        mock_redis.ping.return_value = True

        await init_redis(app)

        assert app.state.redis_client is mock_redis
        mock_redis.ping.assert_called_once()
        mock_redis.close.assert_not_called()


@pytest.mark.anyio
async def test_init_redis_retries_transient_error_and_pings_new_client():
    """A failed connection is retried with a fresh client before succeeding."""
    app = FastAPI()
    failed_client = AsyncMock()
    ready_client = AsyncMock()
    failed_client.ping.side_effect = TimeoutError("connection timed out")

    with (
        patch(
            "lcfs.services.redis.lifetime.Redis",
            side_effect=[failed_client, ready_client],
        ) as redis_factory,
        patch(
            "lcfs.services.redis.lifetime.asyncio.sleep", new_callable=AsyncMock
        ) as sleep,
    ):
        await init_redis(app)

    assert app.state.redis_client is ready_client
    assert redis_factory.call_count == 2
    failed_client.ping.assert_awaited_once()
    ready_client.ping.assert_awaited_once()
    sleep.assert_awaited_once_with(1)
    failed_client.close.assert_awaited_once()


@pytest.mark.anyio
async def test_init_redis_raises_after_last_redis_error():
    """Redis errors remain visible to startup after the configured retries."""
    app = FastAPI()
    clients = [AsyncMock() for _ in range(5)]
    for client in clients:
        client.ping.side_effect = RedisError("Redis is unavailable")

    with (
        patch(
            "lcfs.services.redis.lifetime.Redis", side_effect=clients
        ) as redis_factory,
        patch(
            "lcfs.services.redis.lifetime.asyncio.sleep", new_callable=AsyncMock
        ) as sleep,
        pytest.raises(RedisError, match="Redis is unavailable"),
    ):
        await init_redis(app)

    assert redis_factory.call_count == 5
    assert sleep.await_count == 4
    assert [call.args[0] for call in sleep.await_args_list] == [1, 2, 4, 8]
    for client in clients:
        client.close.assert_awaited_once()


@pytest.mark.anyio
async def test_init_redis_does_not_retry_unexpected_errors():
    app = FastAPI()
    client = AsyncMock()
    client.ping.side_effect = ValueError("invalid client configuration")

    with (
        patch(
            "lcfs.services.redis.lifetime.Redis", return_value=client
        ) as redis_factory,
        patch(
            "lcfs.services.redis.lifetime.asyncio.sleep", new_callable=AsyncMock
        ) as sleep,
        pytest.raises(ValueError, match="invalid client configuration"),
    ):
        await init_redis(app)

    redis_factory.assert_called_once()
    sleep.assert_not_awaited()
    client.close.assert_awaited_once()


@pytest.mark.anyio
async def test_shutdown_redis_success():
    """
    Test Redis client shutdown succeeds.
    """
    app = FastAPI()
    mock_redis = AsyncMock()
    app.state.redis_client = mock_redis

    await shutdown_redis(app)

    mock_redis.close.assert_called_once()


@pytest.mark.anyio
async def test_shutdown_redis_no_client():
    """
    Test Redis shutdown when no client exists.
    """
    app = FastAPI()
    await shutdown_redis(app)  # Should not raise any exceptions


@pytest.mark.anyio
async def test_shutdown_redis_swallows_redis_close_error():
    """A Redis close failure does not prevent application shutdown."""
    app = FastAPI()
    client = AsyncMock()
    client.close.side_effect = RedisError("close failed")
    app.state.redis_client = client

    await shutdown_redis(app)

    client.close.assert_awaited_once()


@pytest.mark.anyio
async def test_get_redis_client_returns_application_client():
    """Request handlers receive the same Redis client stored on app state."""
    app = FastAPI()
    client = AsyncMock()
    app.state.redis_client = client
    request = Request({"type": "http", "app": app, "headers": []})

    assert await get_redis_client(request) is client
