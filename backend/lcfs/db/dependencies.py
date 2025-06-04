from typing import AsyncGenerator
import structlog
import re
import sqlalchemy as sa
from alembic import op
import os

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
    pool_size=30,
    max_overflow=50,
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


def create_role_if_not_exists():
    """Create database role and user if they don't exist"""
    try:
        # Check if role exists
        result = (
            op.get_bind()
            .execute(
                sa.text(
                    "SELECT 1 FROM pg_roles WHERE rolname = 'basic_lcfs_reporting_role'"
                )
            )
            .fetchone()
        )

        if not result:
            print("Creating basic_lcfs_reporting_role...")
            op.execute("CREATE ROLE basic_lcfs_reporting_role")
            op.execute(
                "REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM basic_lcfs_reporting_role;"
            )
            op.execute(
                "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO basic_lcfs_reporting_role;"
            )
        else:
            print("Role basic_lcfs_reporting_role already exists")

    except Exception as e:
        print(f"Note: Role/user creation issue (continuing): {e}")


def find_and_read_sql_file():
    """Find and read the SQL file"""
    current_dir = os.path.dirname(__file__)

    # Possible paths to try
    possible_paths = [
        os.path.join(current_dir, "sql", "views", "upgrade.sql"),
        os.path.join(current_dir, "..", "..", "sql", "views", "upgrade.sql"),
    ]

    for path in possible_paths:
        normalized_path = os.path.normpath(path)
        print(f"Trying: {normalized_path}")
        if os.path.exists(normalized_path):
            print(f"Found SQL file at: {normalized_path}")
            with open(normalized_path, "r") as f:
                return f.read()

    raise FileNotFoundError("Could not find sql/views/upgrade.sql")


def clean_and_split_sql(content):
    """Clean SQL content and split into executable statements"""
    # Remove comment-only lines that are just separators
    lines = []
    for line in content.split("\n"):
        stripped = line.strip()
        # Skip lines that are just comment separators (-- ===...)
        if stripped.startswith("--") and (
            "=" in stripped
            and len(stripped.replace("-", "").replace("=", "").strip()) == 0
        ):
            continue
        lines.append(line)

    # Rejoin the content
    cleaned_content = "\n".join(lines)

    # Split by semicolon to get individual statements
    # But be smarter about it - don't split on semicolons inside quoted strings
    statements = []
    current_statement = []
    in_quotes = False
    quote_char = None

    i = 0
    while i < len(cleaned_content):
        char = cleaned_content[i]

        # Handle quotes
        if char in ('"', "'") and (i == 0 or cleaned_content[i - 1] != "\\"):
            if not in_quotes:
                in_quotes = True
                quote_char = char
            elif char == quote_char:
                in_quotes = False
                quote_char = None

        # Handle semicolons
        elif char == ";" and not in_quotes:
            # End of statement
            stmt = "".join(current_statement).strip()
            if stmt:
                statements.append(stmt)
            current_statement = []
            i += 1
            continue

        current_statement.append(char)
        i += 1

    # Don't forget the last statement if it doesn't end with semicolon
    final_stmt = "".join(current_statement).strip()
    if final_stmt:
        statements.append(final_stmt)

    # Filter out empty statements and comment-only statements
    filtered_statements = []
    for stmt in statements:
        stmt = stmt.strip()
        if not stmt:
            continue

        # Skip statements that are only comments
        lines = stmt.split("\n")
        has_sql = False
        for line in lines:
            line = line.strip()
            if line and not line.startswith("--"):
                has_sql = True
                break

        if has_sql:
            filtered_statements.append(stmt)

    return filtered_statements
