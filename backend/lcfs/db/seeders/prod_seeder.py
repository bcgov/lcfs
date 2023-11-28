import logging
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from lcfs.settings import settings

logger = logging.getLogger(__name__)

async def seed_prod():
    """
    Function to seed the database with prod data.
    """
    engine = create_async_engine(str(settings.db_url))
    AsyncSessionLocal = sessionmaker(bind=engine, class_=AsyncSession)

    async with AsyncSessionLocal() as session:
        try:
            logger.info("Database seeding completed successfully.")
        except Exception as e:
            logger.error(f"An error occurred during seeding: {e}")
            await session.rollback()

if __name__ == "__main__":
    asyncio.run(seed_prod())
