import logging
from typing import AsyncGenerator

from fastapi import Request
from redis import asyncio as aioredis
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from lcfs.db.base import current_user_var, get_current_user
from lcfs.settings import settings

if settings.environment == "dev":
    pass

db_url = make_url(str(settings.db_url.with_path(f"/{settings.db_base}")))
async_engine = create_async_engine(db_url, future=True)
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARN)

async def set_user_context(session: AsyncSession, username: str):
    """
    Set user_id context for the session to be used in auditing.
    """
    try:
        await session.execute(text(f"SET SESSION app.username = '{username}'"))

        logging.info(f"SET SESSION app.username = '{username}' executed successfully")

    except Exception as e:
        logging.error(f"Failed to execute SET LOCAL app.user_id = '{username}': {e}")
        raise e


async def get_async_db_session(request: Request) -> AsyncGenerator[AsyncSession, None]:
    """
    Create and get database session.
    :yield: database session.
    """
    async with AsyncSession(async_engine) as session:
        async with session.begin():
            if request.user:
                current_user_var.set(request.user)
                current_user = get_current_user()
                await set_user_context(session, current_user)
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
