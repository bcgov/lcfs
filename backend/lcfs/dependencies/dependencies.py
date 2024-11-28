from fastapi import Request
from redis.asyncio import Redis
import boto3

async def get_redis_pool(request: Request) -> Redis:
    return request.app.state.redis_pool

async def get_s3_client(request: Request) -> boto3.client:
    return request.app.state.s3_client