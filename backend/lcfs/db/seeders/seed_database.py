import sys
import asyncio
import structlog

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from lcfs.db.seeders.dev_seeder import seed_dev
from lcfs.db.seeders.prod_seeder import seed_prod
from lcfs.db.seeders.staging_seeder import seed_staging
from lcfs.db.seeders.pytest_seeder import seed_pytest
from lcfs.settings import settings

logger = structlog.get_logger(__name__)


async def seed_database(environment):
    engine = create_async_engine(str(settings.db_url))
    AsyncSessionLocal = sessionmaker(bind=engine, class_=AsyncSession)

    async with AsyncSessionLocal() as session:
        async with session.begin():
            try:
                logger.info("Database seeding started.")

                if environment == "dev":
                    await seed_dev(session)
                elif environment == "prod":
                    await seed_prod(session)
                elif environment == "staging":
                    await seed_staging(session)
                elif environment == "pytest":
                    await seed_pytest(session)
                else:
                    raise ValueError(f"Unknown environment: {environment}")

                # commit all seeders
                await session.commit()

            except Exception as e:
                context = {
                    "function": "seed_database",
                }
                logger.error(
                    "An error occurred during seeding",
                    error=str(e),
                    exc_info=e,
                    **context,
                )
                await session.rollback()  # Ensure to rollback in case of an error
                raise


if __name__ == "__main__":
    env = sys.argv[1] if len(sys.argv) > 1 else "dev"
    asyncio.run(seed_database(env))
