import logging
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from lcfs.settings import settings

from lcfs.db.seeders.dev.user_profile_seeder import seed_user_profiles
from lcfs.db.seeders.dev.user_role_seeder import seed_user_roles

logger = logging.getLogger(__name__)

async def seed_database():
    """
    Main function to seed the database.
    """
    engine = create_async_engine(str(settings.db_url))
    AsyncSessionLocal = sessionmaker(bind=engine, class_=AsyncSession)

    async with AsyncSessionLocal() as session:
        try:
            await seed_user_profiles(session)
            await seed_user_roles(session)
            logger.info("Database seeding completed successfully.")
        except Exception as e:
            logger.error(f"An error occurred during seeding: {e}")
            await session.rollback()

if __name__ == "__main__":
    asyncio.run(seed_database())
