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


def find_and_read_sql_file(sqlFile):
    """Find and read the SQL file"""
    current_dir = os.path.dirname(__file__)

    # Possible paths to try
    possible_paths = [
        os.path.join(current_dir, "sql", "views", sqlFile),
        os.path.join(current_dir, "..", "..", "sql", "views", sqlFile),
    ]

    for path in possible_paths:
        normalized_path = os.path.normpath(path)
        print(f"Trying: {normalized_path}")
        if os.path.exists(normalized_path):
            print(f"Found SQL file at: {normalized_path}")
            with open(normalized_path, "r") as f:
                return f.read()

    raise FileNotFoundError("Could not find sql/views/upgrade.sql")


def parse_sql_sections(content):
    """Parse SQL content into named sections"""
    sections = {}
    current_section = None
    current_sql = []

    lines = content.split("\n")
    i = 0

    while i < len(lines):
        line = lines[i].strip()

        # Look for section headers with === separators
        if line.startswith("--") and "=" in line and len(line) > 20:
            # This might be a separator line, check next few lines for section name
            if i + 1 < len(lines):
                next_line = lines[i + 1].strip()
                if (
                    next_line.startswith("--")
                    and "=" not in next_line
                    and next_line.replace("--", "").strip()
                ):
                    # Save previous section
                    if current_section and current_sql:
                        sql_content = "\n".join(current_sql).strip()
                        if sql_content:
                            sections[current_section] = sql_content

                    # Start new section
                    current_section = next_line.replace("--", "").strip()
                    current_sql = []

                    # Skip the separator lines and section name
                    i += 2
                    while (
                        i < len(lines)
                        and lines[i].strip().startswith("--")
                        and "=" in lines[i]
                    ):
                        i += 1
                    continue

        # Add content to current section (skip separator lines)
        elif current_section and not (
            line.startswith("--") and "=" in line and len(line) > 15
        ):
            current_sql.append(lines[i])

        i += 1

    # Save last section
    if current_section and current_sql:
        sql_content = "\n".join(current_sql).strip()
        if sql_content:
            sections[current_section] = sql_content

    return sections


def execute_sql_sections(sections, SECTIONS_TO_EXECUTE):
    """Execute specified sections or all sections if SECTIONS_TO_EXECUTE is empty"""
    if not SECTIONS_TO_EXECUTE:
        # Execute all sections
        sections_to_run = list(sections.keys())
        print(
            f"SECTIONS_TO_EXECUTE is empty - executing all {len(sections_to_run)} sections"
        )
    else:
        # Execute only specified sections
        sections_to_run = SECTIONS_TO_EXECUTE
        print(f"Executing {len(sections_to_run)} specified sections: {sections_to_run}")

    print(f"Available sections: {list(sections.keys())}")

    executed_count = 0
    for section_name in sections_to_run:
        if section_name in sections:
            print(f"Executing section: {section_name}")

            # Split by semicolon and execute each statement
            sql_content = sections[section_name]
            statements = [
                stmt.strip() for stmt in sql_content.split(";") if stmt.strip()
            ]

            for i, statement in enumerate(statements, 1):
                if statement.strip():
                    try:
                        print(
                            f"  Statement {i}/{len(statements)}: {statement.split()[0:3]}"
                        )
                        op.execute(sa.text(statement))
                    except Exception as e:
                        print(
                            f"Error executing statement {i} in section '{section_name}': {e}"
                        )
                        print(f"Statement: {statement[:200]}...")
                        raise
            executed_count += 1
        else:
            print(f"Warning: Section '{section_name}' not found in SQL file")
            print(f"Available sections: {list(sections.keys())}")

    print(f"Successfully executed {executed_count} sections!")
