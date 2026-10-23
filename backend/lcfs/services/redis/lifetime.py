import asyncio

import structlog
from fastapi import FastAPI
from redis.asyncio import Redis
from redis.exceptions import RedisError, TimeoutError

from lcfs.settings import settings

logger = structlog.get_logger(__name__)


async def _close_redis_client(client: Redis) -> bool:
    """Close a Redis client without masking the error that triggered cleanup."""
    try:
        await client.close()
        return True
    except RedisError as e:
        logger.error(f"Redis error while closing client: {e}")
    except Exception as e:
        logger.error(f"Unexpected error while closing Redis client: {e}")
    return False


async def init_redis(app: FastAPI) -> None:
    """
    Initializes the Redis client and tests the connection.

    :param app: current FastAPI application.
    """
    retries = 5  # Retry logic in case Redis is unavailable initially
    for i in range(retries):
        redis_client = None
        try:
            # Initialize Redis client
            redis_client = Redis(
                host=settings.redis_host,
                port=settings.redis_port,
                password=settings.redis_pass,
                db=settings.redis_base or 0,
                decode_responses=True,
                max_connections=10,
                socket_timeout=5,
                socket_connect_timeout=5,
            )
            app.state.redis_client = redis_client

            # Test the connection
            await redis_client.ping()
            logger.info("Redis client initialized and connection successful.")
            break
        except TimeoutError as e:
            if redis_client is not None:
                await _close_redis_client(redis_client)
            logger.error(f"Redis timeout during initialization attempt {i + 1}: {e}")
            if i == retries - 1:
                raise
            await asyncio.sleep(2**i)  # Exponential backoff
        except RedisError as e:
            if redis_client is not None:
                await _close_redis_client(redis_client)
            logger.error(f"Redis error during initialization attempt {i + 1}: {e}")
            if i == retries - 1:
                raise
            await asyncio.sleep(2**i)  # Exponential backoff
        except Exception as e:
            if redis_client is not None:
                await _close_redis_client(redis_client)
            logger.error(f"Unexpected error during Redis initialization: {e}")
            raise


async def shutdown_redis(app: FastAPI) -> None:
    """
    Closes the Redis client during application shutdown.

    :param app: current FastAPI app.
    """
    try:
        if hasattr(app.state, "redis_client") and app.state.redis_client:
            if await _close_redis_client(app.state.redis_client):
                logger.info("Redis client closed successfully.")
    except Exception as e:
        logger.error(f"Unexpected error during Redis shutdown: {e}")
