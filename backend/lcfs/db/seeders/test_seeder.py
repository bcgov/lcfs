import logging
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from lcfs.db.seeders.test.test_admin_adjustment_seeder import (
    seed_test_admin_adjustments,
)
from lcfs.settings import settings

from lcfs.db.seeders.test.test_organization_seeder import seed_test_organizations
from lcfs.db.seeders.test.test_user_profile_seeder import seed_test_user_profiles
from lcfs.db.seeders.test.test_user_role_seeder import seed_test_user_roles
from lcfs.db.seeders.test.test_transfer_seeder import seed_test_transfers
from lcfs.db.seeders.test.test_transaction_seeder import seed_test_transactions
from lcfs.db.seeders.dev.fuel_code_seeder import seed_fuel_codes
from lcfs.db.seeders.dev.finished_fuel_transfer_mode_seeder import (
    seed_finished_fuel_transfer_modes,
)
from lcfs.db.seeders.dev.feedstock_fuel_transfer_mode_seeder import (
    seed_feedstock_fuel_transfer_modes,
)
from lcfs.db.seeders.dev.expected_use_types_seeder import seed_expected_use_types

logger = logging.getLogger(__name__)


async def update_sequences(session: AsyncSession):
    """
    Function to update sequences for all tables after seeding.
    """
    sequences = {
        "organization": "organization_id",
        "user_profile": "user_profile_id",
        "user_role": "user_role_id",
        "transaction": "transaction_id",
        "admin_adjustment": "admin_adjustment_id",
        # Add other tables and their primary key columns as needed
    }

    for table, column in sequences.items():
        sequence_name = f"{table}_{column}_seq"
        max_value_query = text(
            f"SELECT setval('{sequence_name}', COALESCE((SELECT MAX({column}) + 1 FROM {table}), 1), false)"
        )
        await session.execute(max_value_query)


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
    await seed_fuel_codes(session)
    await seed_finished_fuel_transfer_modes(session)
    await seed_feedstock_fuel_transfer_modes(session)
    await seed_expected_use_types(session)

    # Update sequences after all seeders have run
    await update_sequences(session)

    logger.info("Test database seeding completed successfully.")


if __name__ == "__main__":
    asyncio.run(seed_test())
