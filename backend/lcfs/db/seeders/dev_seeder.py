import logging
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from lcfs.settings import settings

from lcfs.db.seeders.dev.user_profile_seeder import seed_user_profiles
from lcfs.db.seeders.dev.user_role_seeder import seed_user_roles
from .dev.organization_address_seeder import seed_organization_addresses
from .dev.organization_attorney_address_seeder import seed_organization_attorney_addresses
from .dev.organization_seeder import seed_organizations
from .dev.transaction_seeder import seed_transactions
from .dev.admin_adjustment_seeder import seed_admin_adjustments
from .dev.fuel_code_seeder import seed_fuel_codes
from .dev.finished_fuel_transfer_mode_seeder import seed_finished_fuel_transfer_modes
from .dev.feedstock_fuel_transfer_mode_seeder import seed_feedstock_fuel_transfer_modes

logger = logging.getLogger(__name__)


async def seed_dev():
    """
    Function to seed the database with dev data.
    """
    engine = create_async_engine(str(settings.db_url))
    AsyncSessionLocal = sessionmaker(bind=engine, class_=AsyncSession)

    async with AsyncSessionLocal() as session:
        try:
            await seed_organization_addresses(session)
            await seed_organization_attorney_addresses(session)
            await seed_organizations(session)
            await seed_transactions(session)
            await seed_admin_adjustments(session)
            await seed_user_profiles(session)
            await seed_user_roles(session)
            await seed_fuel_codes(session)
            await seed_finished_fuel_transfer_modes(session)
            await seed_feedstock_fuel_transfer_modes(session)
            logger.info("Database seeding completed successfully.")
        except Exception as e:
            logger.error(f"An error occurred during seeding: {e}")
            await session.rollback()

if __name__ == "__main__":
    asyncio.run(seed_dev())
