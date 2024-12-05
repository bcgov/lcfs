from redis.asyncio import Redis
from starlette.requests import Request


# Redis Client Dependency
async def get_redis_client(
    request: Request,
) -> Redis:
    """
    Returns the Redis client.

    Usage:
        >>> async def handler(redis_client: Redis = Depends(get_redis_client)):
        >>>     value = await redis_client.get('key')

    :param request: Current request object.
    :returns: Redis client.
    """
    return request.app.state.redis_client
