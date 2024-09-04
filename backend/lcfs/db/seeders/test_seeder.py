import logging
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from lcfs.db.seeders.test.test_admin_adjustment_seeder import seed_test_admin_adjustments
from lcfs.settings import settings

from lcfs.db.seeders.test.test_organization_seeder import seed_test_organizations
from lcfs.db.seeders.test.test_user_profile_seeder import seed_test_user_profiles
from lcfs.db.seeders.test.test_user_role_seeder import seed_test_user_roles
from lcfs.db.seeders.test.test_transfer_seeder import seed_test_transfers
from lcfs.db.seeders.test.test_transaction_seeder import seed_test_transactions

logger = logging.getLogger(__name__)

async def seed_test(session: AsyncSession):
    """
    Function to seed the database with test data.
    """
    await seed_test_organizations(session)
    await seed_test_user_profiles(session)
    await seed_test_user_roles(session)
    await seed_test_transactions(session)
    await seed_test_admin_adjustments(session)
    # await seed_test_transfers(session)
    logger.info("Test database seeding completed successfully.")

if __name__ == "__main__":
    asyncio.run(seed_test())
