from typing import AsyncGenerator
import structlog
import asyncio

from fastapi import Request
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from lcfs.db.base import current_user_var, get_current_user
from lcfs.settings import settings

if settings.environment == "dev":
    pass

db_url = make_url(str(settings.db_url.with_path(f"/{settings.db_base}")))
async_engine = create_async_engine(
    db_url,
    future=True,
    pool_pre_ping=True,  # Test connections before using them
    pool_size=5,  # Base pool size
    max_overflow=10,  # Allow up to 10 connections beyond pool_size
    pool_timeout=30,  # Timeout for getting a connection from pool
    pool_recycle=1800,  # Recycle connections after 30 minutes
    echo=settings.db_echo,
)
logger = structlog.get_logger("sqlalchemy.engine")


async def set_user_context(session: AsyncSession, username: str):
    """
    Set user_id context for the session to be used in auditing.
    """
    try:
        await session.execute(text(f"SET SESSION app.username = '{username}'"))
    except Exception as e:
        structlog.get_logger().error(
            f"Failed to execute SET LOCAL app.user_id = '{username}': {e}"
        )
        raise e


async def get_async_db_session(
    request: Request,
) -> AsyncGenerator[AsyncSession, None]:
    """
    Create and get database session with retry logic.
    :yield: database session.
    """
    max_retries = 3
    retry_count = 0

    while retry_count < max_retries:
        try:
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
                        break
                    except Exception as e:
                        await session.rollback()
                        raise e
                    finally:
                        await session.close()
        except Exception as e:
            retry_count += 1
            if retry_count == max_retries:
                logger.error(
                    "Failed to establish database connection after multiple retries",
                    error=str(e),
                    retry_count=retry_count,
                )
                raise e
            logger.warning(
                "Database connection attempt failed, retrying...",
                error=str(e),
                retry_count=retry_count,
            )
            await asyncio.sleep(1)  # Wait before retrying
