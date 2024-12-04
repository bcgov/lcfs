from redis.asyncio import ConnectionPool
from starlette.requests import Request


# Redis Pool Dependency
async def get_redis_pool(
    request: Request,
) -> ConnectionPool:
    """
    Returns the Redis connection pool.

    Usage:
        >>> from redis.asyncio import ConnectionPool, Redis
        >>>
        >>> async def handler(redis_pool: ConnectionPool = Depends(get_redis_pool)):
        >>>     redis = Redis(connection_pool=redis_pool)
        >>>     await redis.get('key')
        >>>     await redis.close()

    :param request: Current request object.
    :returns: Redis connection pool.
    """
    return request.app.state.redis_pool
