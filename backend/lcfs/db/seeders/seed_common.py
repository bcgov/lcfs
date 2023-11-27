import logging
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from lcfs.settings import settings

from lcfs.db.seeders.common.organization_type_seeder import seed_organization_types
from lcfs.db.seeders.common.organization_status_seeder import seed_organization_statuses
from lcfs.db.seeders.common.organization_seeder import seed_organizations
from lcfs.db.seeders.common.role_seeder import seed_roles

logger = logging.getLogger(__name__)

async def seed_database():
    """
    Main function to seed the database.
    """
    engine = create_async_engine(str(settings.db_url))
    AsyncSessionLocal = sessionmaker(bind=engine, class_=AsyncSession)

    async with AsyncSessionLocal() as session:
        try:
            await seed_organization_types(session)
            await seed_organization_statuses(session)
            await seed_organizations(session)
            await seed_roles(session)
            logger.info("Database seeding completed successfully.")
        except Exception as e:
            logger.error(f"An error occurred during seeding: {e}")
            await session.rollback()

if __name__ == "__main__":
    asyncio.run(seed_database())
