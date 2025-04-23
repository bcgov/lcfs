import pytest
from unittest.mock import AsyncMock, patch
from fastapi import FastAPI
from redis.exceptions import RedisError
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
