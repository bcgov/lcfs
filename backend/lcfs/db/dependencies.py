import logging
from typing import AsyncGenerator

from fastapi import Request
from redis import asyncio as aioredis
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from lcfs.db.base import current_user_var
from lcfs.settings import settings

if settings.environment == "dev":
    pass

db_url = make_url(str(settings.db_url.with_path(f"/{settings.db_base}")))
async_engine = create_async_engine(db_url, future=True)
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARN)


async def get_async_db_session(request: Request) -> AsyncGenerator[AsyncSession, None]:
    """
    Create and get database session.
    :yield: database session.
    """
    async with AsyncSession(async_engine) as session:
        async with session.begin():
            if request.user:
                current_user_var.set(request.user)
            try:
                yield session
                await session.flush()
                await session.commit()
            except Exception as e:
                await session.rollback()  # Roll back the transaction on error
                raise e
            finally:
                await session.close()  # Always close the session to free up the connection


def create_redis():
    return aioredis.ConnectionPool(
        host=settings.redis_host,
        port=settings.redis_port,
        db=settings.redis_db,
        decode_responses=True,
    )


pool = create_redis()
