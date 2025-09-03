#!/usr/bin/env python3
"""
Standalone script to create/recreate database views in proper dependency order.
Reuses existing parsing functions and follows the same pattern as seed_database.py

Usage:
    python create_views.py [environment]
    python create_views.py dev
    python create_views.py prod
"""

import sys
import asyncio
import structlog
from typing import Dict, List
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from sqlalchemy.engine import make_url

from lcfs.settings import settings
from lcfs.db.dependencies import (
    find_and_read_sql_file,
    parse_sql_sections,
    create_role_if_not_exists,
)

logger = structlog.get_logger(__name__)


class ViewCreator:
    """Handles creation of database views in proper dependency order"""

    def __init__(self, session: AsyncSession):
        self.session = session

        # Define execution order based on dependency levels
        # These section names should match the headers in your SQL file
        self.execution_order = [
            # Level 1: Base views (no view dependencies)
            "Compliance Reports List View",
            "Transfer base Analytics View",
            "User Login Analytics Base View",
            "Transaction Base View",
            "Fuel Code Base View",
            "Compliance Reports Time Per Status",
            "Notional Transfer Base View",
            "Fuels for Other Use Data Model",
            # Level 2: Views depending on Level 1
            "Compliance Reports Analytics View",
            "BCeID Daily Login Summary View",
            "BCeID User Statistics View",
            "Login Failures Analysis View",
            "Compliance Report Base View With Early Issuance By Year",
            "Final Supply Equipment Base View",
            "Electricity Allocation FSE Match Query",
            "Allocation Agreement Duplicate Check",
            "Final Supply Equipment Duplicate Check",
            # Level 3: Views depending on Level 2
            "Compliance Reports Waiting review",
            "Fuel Supply Analytics Base View",
            "Fuel Export Analytics Base View",
            "Allocation agreement Analytics Base View",
            "Allocation Agreement Base View With Early Issuance By Year",
        ]

    async def create_role_if_not_exists_async(self):
        """Create database role if it doesn't exist (async version)"""
        try:
            # Check if role exists
            result = await self.session.execute(
                text(
                    "SELECT 1 FROM pg_roles WHERE rolname = 'basic_lcfs_reporting_role'"
                )
            )

            if not result.fetchone():
                logger.info("Creating basic_lcfs_reporting_role...")
                await self.session.execute(
                    text("CREATE ROLE basic_lcfs_reporting_role")
                )
                await self.session.execute(
                    text(
                        "REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM basic_lcfs_reporting_role;"
                    )
                )
                await self.session.execute(
                    text(
                        "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO basic_lcfs_reporting_role;"
                    )
                )
                logger.info("Successfully created basic_lcfs_reporting_role")
            else:
                logger.info("Role basic_lcfs_reporting_role already exists")

        except Exception as e:
            logger.warning(f"Role creation issue (continuing): {e}")

    async def drop_all_views(self):
        """Drop all existing views in reverse dependency order"""
        logger.info("Dropping existing views...")

        # Get all views that match our naming pattern
        view_query = text(
            """
            SELECT viewname 
            FROM pg_views 
            WHERE schemaname = current_schema()
            AND (viewname LIKE 'vw_%')
            ORDER BY viewname
        """
        )

        result = await self.session.execute(view_query)
        existing_views = [row[0] for row in result.fetchall()]

        # Drop views in reverse order to handle dependencies
        for view_name in reversed(existing_views):
            try:
                await self.session.execute(
                    text(f"DROP VIEW IF EXISTS {view_name} CASCADE")
                )
                logger.debug(f"Dropped view: {view_name}")
            except Exception as e:
                logger.warning(f"Could not drop view {view_name}: {e}")

    async def execute_sql_section(self, section_name: str, sql_content: str):
        """Execute a single SQL section with proper error handling"""
        logger.info(f"Executing section: {section_name}")

        # Split by semicolon and execute each statement
        statements = [stmt.strip() for stmt in sql_content.split(";") if stmt.strip()]

        for i, statement in enumerate(statements, 1):
            if statement.strip():
                try:
                    # Log first few words for debugging
                    stmt_preview = " ".join(statement.split()[:5])
                    logger.debug(
                        f"  Statement {i}/{len(statements)}: {stmt_preview}..."
                    )
                    await self.session.execute(text(statement))
                except Exception as e:
                    logger.error(
                        f"Error executing statement {i} in section '{section_name}': {e}"
                    )
                    logger.error(f"Statement preview: {statement[:200]}...")
                    raise

    async def create_all_views(self, sections: Dict[str, str]):
        """Create all views in proper dependency order"""
        logger.info("Creating views in dependency order...")

        executed_count = 0
        for section_name in self.execution_order:
            if section_name in sections:
                await self.execute_sql_section(section_name, sections[section_name])
                executed_count += 1
            else:
                logger.warning(f"Section '{section_name}' not found in SQL file")
                logger.info(f"Available sections: {list(sections.keys())}")

        # Execute any remaining sections not in execution_order
        remaining_sections = set(sections.keys()) - set(self.execution_order)
        if remaining_sections:
            logger.info(f"Executing {len(remaining_sections)} additional sections...")
            for section_name in remaining_sections:
                await self.execute_sql_section(section_name, sections[section_name])
                executed_count += 1

        logger.info(f"Successfully executed {executed_count} sections")

async def create_views(environment: str = "dev"):
    """Main function to create all database views"""

    # Create database connection
    db_url = make_url(str(settings.db_url.with_path(f"/{settings.db_base}")))
    engine = create_async_engine(
        db_url,
        future=True,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
    )

    AsyncSessionLocal = sessionmaker(bind=engine, class_=AsyncSession)

    async with AsyncSessionLocal() as session:
        async with session.begin():
            try:
                logger.info(f"Starting view creation for environment: {environment}")

                view_creator = ViewCreator(session)

                # Step 1: Create role if needed
                await view_creator.create_role_if_not_exists_async()

                # Step 2: Read and parse SQL file
                logger.info("Reading SQL file...")
                content = find_and_read_sql_file("metabase.sql")
                sections = parse_sql_sections(content)

                if not sections:
                    raise ValueError("No SQL sections found in file")

                logger.info(f"Found {len(sections)} sections in SQL file")
                logger.debug(f"Available sections: {list(sections.keys())}")

                # Step 3: Drop existing views
                await view_creator.drop_all_views()

                # Step 4: Create views in proper order
                await view_creator.create_all_views(sections)

                # Commit all changes
                await session.commit()

                logger.info("View creation completed successfully")

            except Exception as e:
                context = {
                    "function": "create_views",
                    "environment": environment,
                }
                logger.error(
                    "An error occurred during view creation",
                    error=str(e),
                    exc_info=e,
                    **context,
                )
                await session.rollback()
                raise

    await engine.dispose()


if __name__ == "__main__":
    env = sys.argv[1] if len(sys.argv) > 1 else "dev"
    asyncio.run(create_views(env))
