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
async_engine = create_async_engine(db_url, future=True)
logger = structlog.get_logger("sqlalchemy.engine")
register_query_analyzer(async_engine.sync_engine)


async def set_user_context(session: AsyncSession, username: str):
    """
    Set user_id context for the session to be used in auditing.
    This function will now manage its own transaction for the SET SESSION command.
    """
    async with session.begin():  # Begin a transaction specifically for this operation
        try:
            # Escape single quotes in username by doubling them up for SQL literal
            escaped_username = username.replace("'", "''")
            # Construct the SQL string with the quoted and escaped username.
            sql_query = text(f"SET SESSION app.username = '{escaped_username}'")
            await session.execute(sql_query)
            await session.commit()  # Commit the transaction for SET SESSION
        except Exception as e:
            await session.rollback()  # Rollback if SET SESSION fails
            structlog.get_logger().error(
                f"Failed to execute SET SESSION app.username = '{username}': {e}"  # Log original username for clarity
            )
            raise e


async def get_async_db_session(
    request: Request,
) -> AsyncGenerator[AsyncSession, None]:
    """
    Create and get database session.
    Ensures user context is set for auditing before the main transaction begins.
    :yield: database session.
    """
    async with AsyncSession(async_engine) as session:
        # Set user context for auditing.
        # This will use the connection from the session. If no transaction is active on the session,
        # session.execute will run this in its own short-lived transaction.
        # This ensures 'app.username' is set on the connection before the main UoW transaction starts.
        if request.user:
            current_user_var.set(request.user)
            current_user = get_current_user()
            await set_user_context(session, current_user)

        # Begin the main transaction for the request's operations.
        # This transaction will use the same connection that now has 'app.username' set.
        async with session.begin():
            try:
                yield session
                # The 'async with session.begin()' block will handle commit upon successful completion
                # or rollback if an exception occurs within the 'yield'ed block.
            except Exception:
                # Rollback is handled by 'async with session.begin()'
                raise
        # Session is automatically closed by 'async with AsyncSession(...)'
