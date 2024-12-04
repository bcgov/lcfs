import logging
from fastapi import FastAPI
from redis.asyncio import Redis
from redis.exceptions import RedisError

from lcfs.settings import settings

logger = logging.getLogger(__name__)


async def init_redis(app: FastAPI) -> None:
    """
    Initializes the Redis client and tests the connection.

    :param app: current FastAPI application.
    """
    try:
        # Initialize Redis client directly
        app.state.redis_client = Redis(
            host=settings.redis_host,
            port=settings.redis_port,
            password=settings.redis_pass,
            db=settings.redis_base or 0,
            decode_responses=True,
            socket_timeout=5,  # Timeout for socket read/write (seconds)
            socket_connect_timeout=5,  # Timeout for connection establishment (seconds)
        )

        # Test the connection
        await app.state.redis_client.ping()
        logger.info("Redis client initialized and connection successful.")
    except RedisError as e:
        logger.error(f"Redis error during initialization: {e}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error during Redis initialization: {e}")
        raise


async def shutdown_redis(app: FastAPI) -> None:
    """
    Closes the Redis client during application shutdown.

    :param app: current FastAPI app.
    """
    try:
        if hasattr(app.state, "redis_client") and app.state.redis_client:
            await app.state.redis_client.close()
        logger.info("Redis client closed successfully.")
    except RedisError as e:
        logger.error(f"Redis error during shutdown: {e}")
    except Exception as e:
        logger.error(f"Unexpected error during Redis shutdown: {e}")
