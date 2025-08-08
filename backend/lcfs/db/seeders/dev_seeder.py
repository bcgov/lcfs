import structlog
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from lcfs.db.seeders.dev.user_profile_seeder import seed_user_profiles
from lcfs.db.seeders.dev.user_role_seeder import seed_user_roles
from lcfs.db.seeders.dev.organization_address_seeder import seed_organization_addresses
from lcfs.db.seeders.dev.organization_attorney_address_seeder import (
    seed_organization_attorney_addresses,
)
from lcfs.db.seeders.dev.organization_seeder import seed_organizations
from lcfs.db.seeders.dev.organization_early_issuance_seeder import (
    seed_organization_early_issuance,
)
from lcfs.db.seeders.dev.transaction_seeder import seed_transactions
from lcfs.db.seeders.dev.admin_adjustment_seeder import seed_admin_adjustments
from lcfs.db.seeders.dev.admin_adjustment_history_seeder import (
    seed_admin_adjustment_history,
)
from lcfs.db.seeders.dev.fuel_code_seeder import seed_fuel_codes
from lcfs.db.seeders.dev.finished_fuel_transfer_mode_seeder import (
    seed_finished_fuel_transfer_modes,
)
from lcfs.db.seeders.dev.feedstock_fuel_transfer_mode_seeder import (
    seed_feedstock_fuel_transfer_modes,
)
from lcfs.db.seeders.dev.notification_channel_subscription_seeder import (
    seed_notification_channel_subscriptions,
)

logger = structlog.get_logger(__name__)


async def update_sequences(session):
    """
    Function to update sequences for all tables after seeding.
    """
    sequences = {
        "organization_address": "organization_address_id",
        "organization": "organization_id",
        "transaction": "transaction_id",
        "admin_adjustment": "admin_adjustment_id",
        "user_profile": "user_profile_id",
        "user_role": "user_role_id",
        "fuel_code": "fuel_code_id",
    }

    for table, column in sequences.items():
        sequence_name = f"{table}_{column}_seq"
        max_value_query = text(
            f"""SELECT setval('{sequence_name}', COALESCE((SELECT MAX({
                column}) + 1 FROM {table}), 1), false)"""
        )
        await session.execute(max_value_query)


async def seed_dev(session: AsyncSession):
    """
    Function to seed the database with dev data.
    """
    await seed_organization_addresses(session)
    await seed_organization_attorney_addresses(session)
    await seed_organizations(session)
    await seed_organization_early_issuance(session)
    await seed_transactions(session)
    await seed_user_profiles(session)
    await seed_user_roles(session)
    await seed_admin_adjustments(session)
    await seed_fuel_codes(session)
    await seed_finished_fuel_transfer_modes(session)
    await seed_feedstock_fuel_transfer_modes(session)
    await seed_notification_channel_subscriptions(session)

    # Update sequences after all seeders have run
    await update_sequences(session)

    # TODO not working with incorrect foreign keys, needs debugging
    # await seed_admin_adjustment_history(session)

    logger.info("Dev database seeding completed successfully.")


if __name__ == "__main__":
    asyncio.run(seed_dev())
