from typing import AsyncGenerator
from fastapi import Request
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from lcfs.db.base import Auditable

from redis import asyncio as aioredis

from lcfs.settings import settings

db_url = make_url(str(settings.db_url.with_path(f"/{settings.db_base}")))
async_engine = create_async_engine(db_url, future=True, echo=True)


async def update_auditable_entries(session: AsyncSession, user_info):
    """
    Update Auditable entries in the session with user information.
    """
    username = getattr(user_info, "keycloak_username", "no_user")
    # print("SESSION TEST", session.new, session.dirty)
    for instance in session.new | session.dirty:
        if isinstance(instance, Auditable):
            if instance in session.new and not instance.create_user:
                instance.create_user = username
            instance.update_user = username


async def get_async_db_session(request: Request) -> AsyncGenerator[AsyncSession, None]:
    """
    Create and get database session.
    :yield: database session.
    """
    async with AsyncSession(async_engine) as session:
        async with session.begin():
            if request.user:
                session.info["user"] = request.user
            try:
                yield session
                # Update Auditable instances before committing
                await update_auditable_entries(session, session.info.get("user", {}))
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
