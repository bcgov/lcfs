import logging
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from lcfs.settings import settings

from lcfs.db.seeders.common.compliance_period_seeder import seed_compliance_periods
from lcfs.db.seeders.common.organization_type_seeder import seed_organization_types
from lcfs.db.seeders.common.organization_status_seeder import seed_organization_statuses
from lcfs.db.seeders.common.role_seeder import seed_roles
from lcfs.db.seeders.common.transfer_status_seeder import seed_transfer_statuses
from lcfs.db.seeders.common.transfer_categories_seeder import seed_transfer_categories
from lcfs.db.seeders.common.admin_adjustment_status_seeder import seed_admin_adjustment_statuses
from lcfs.db.seeders.common.initiative_agreement_status_seeder import seed_initiative_agreement_statuses
from lcfs.db.seeders.common.fuel_data_seeder import seed_static_fuel_data
from lcfs.db.seeders.common.compliance_report_status_seeder import seed_compliance_report_statuses

logger = logging.getLogger(__name__)


async def seed_common():
    """
    Function to seed the database with common data.
    """
    engine = create_async_engine(str(settings.db_url))
    AsyncSessionLocal = sessionmaker(bind=engine, class_=AsyncSession)

    async with AsyncSessionLocal() as session:
        try:
            await seed_compliance_periods(session)
            await seed_organization_types(session)
            await seed_organization_statuses(session)
            await seed_roles(session)
            await seed_transfer_statuses(session)
            await seed_transfer_categories(session)
            await seed_admin_adjustment_statuses(session)
            await seed_initiative_agreement_statuses(session)
            await seed_static_fuel_data(session)
            await seed_compliance_report_statuses(session)
            logger.info("Database seeding completed successfully.")
        except Exception as e:
            logger.error(f"An error occurred during seeding: {e}")
            await session.rollback()


if __name__ == "__main__":
    asyncio.run(seed_common())
