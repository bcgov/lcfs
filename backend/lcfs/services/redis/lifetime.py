import logging
from fastapi import FastAPI
from redis.asyncio import ConnectionPool, Redis
from redis.exceptions import RedisError

from lcfs.settings import settings

logger = logging.getLogger(__name__)


async def init_redis(app: FastAPI) -> None:
    """
    Creates connection pool for redis.

    :param app: current fastapi application.
    """
    try:
        app.state.redis_pool = ConnectionPool.from_url(
            str(settings.redis_url),
            encoding="utf8",
            decode_responses=True,
            max_connections=200,
        )
        # Test the connection
        redis = Redis(connection_pool=app.state.redis_pool)
        await redis.ping()
        await redis.close()
        logger.info("Redis pool initialized successfully.")
    except RedisError as e:
        logger.error(f"Redis error during initialization: {e}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error during Redis initialization: {e}")
        raise


async def shutdown_redis(app: FastAPI) -> None:  # pragma: no cover
    """
    Closes redis connection pool.

    :param app: current FastAPI app.
    """
    try:
        if hasattr(app.state, "redis_pool"):
            await app.state.redis_pool.disconnect(inuse_connections=True)
        logger.info("Redis pool closed successfully.")
    except RedisError as e:
        logger.error(f"Redis error during shutdown: {e}")
    except Exception as e:
        logger.error(f"Unexpected error during Redis shutdown: {e}")
