from typing import AsyncGenerator
import structlog

from fastapi import Request
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from lcfs.db.base import current_user_var, get_current_user
from lcfs.settings import settings
from lcfs.utils.query_analyzer import register_query_analyzer

if settings.environment == "dev":
    pass

db_url = make_url(str(settings.db_url.with_path(f"/{settings.db_base}")))
async_engine = create_async_engine(
    db_url,
    future=True,
    pool_size=50,
    max_overflow=100,
    pool_pre_ping=True,
    pool_recycle=3600,
    pool_timeout=30,
    pool_reset_on_return="commit",
)
logger = structlog.get_logger("sqlalchemy.engine")
register_query_analyzer(async_engine.sync_engine)


async def set_user_context(session: AsyncSession, username: str):
    """
    Set user_id context for the session to be used in auditing.
    This executes within the existing session context without managing its own transaction.
    """
    try:
        # Escape single quotes in username by doubling them up for SQL literal
        escaped_username = username.replace("'", "''")
        # Construct the SQL string with the quoted and escaped username.
        sql_query = text(f"SET SESSION app.username = '{escaped_username}'")
        await session.execute(sql_query)
    except Exception as e:
        structlog.get_logger().error(
            f"Failed to execute SET SESSION app.username = '{username}': {e}"  # Log original username for clarity
        )
        raise e


async def get_async_db_session(
    request: Request,
) -> AsyncGenerator[AsyncSession, None]:
    """
    Create and get database session.
    Ensures user context is set for auditing within the transaction.
    :yield: database session.
    """
    async with AsyncSession(async_engine) as session:
        # Begin the main transaction for the request's operations.
        try:
            async with session.begin():
                try:
                    # Set user context for auditing within the transaction.
                    # This ensures 'app.username' is set on the connection within the active transaction.
                    if request.user:
                        current_user_var.set(request.user)
                        current_user = get_current_user()
                        await set_user_context(session, current_user)

                    yield session
                    # The 'async with session.begin()' block will handle commit upon successful completion
                    # or rollback if an exception occurs within the 'yield'ed block.
                except Exception as e:
                    logger.error(f"Error in database session: {e}", exc_info=True)
                    # Rollback is handled by 'async with session.begin()'
                    raise
        except Exception as e:
            logger.error(f"Error creating database transaction: {e}", exc_info=True)
            raise
        # Session is automatically closed by 'async with AsyncSession(...)'
