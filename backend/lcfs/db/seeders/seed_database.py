import sys
import asyncio
import logging

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from lcfs.db.seeders.common_seeder import seed_common
from lcfs.db.seeders.dev_seeder import seed_dev
from lcfs.db.seeders.prod_seeder import seed_prod
from lcfs.db.seeders.test_seeder import seed_test
from lcfs.settings import settings

logger = logging.getLogger(__name__)

async def seed_database(environment):
    engine = create_async_engine(str(settings.db_url))
    AsyncSessionLocal = sessionmaker(bind=engine, class_=AsyncSession)

    async with AsyncSessionLocal() as session:
        async with session.begin():
            try:
                logger.info("Database seeding started.")
                await seed_common(session)

                if environment == 'dev':
                    await seed_dev(session)
                elif environment == 'prod':
                    await seed_prod(session)
                elif environment == 'test':
                    await seed_test(session)
                else:
                    raise ValueError("Unknown environment")
                
                # commit all seeders
                await session.commit()

            except Exception as e:
                logger.error(f"An error occurred during seeding: {e}")
                await session.rollback()  # Ensure to rollback in case of an error
                raise

if __name__ == "__main__":
    env = sys.argv[1] if len(sys.argv) > 1 else 'dev'
    asyncio.run(seed_database(env))
