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
from lcfs.db.seeders.dev.admin_adjustment_seeder import seed_admin_adjustments
from lcfs.db.seeders.dev.admin_adjustment_history_seeder import (
    seed_admin_adjustment_history,
)
from lcfs.db.seeders.dev.finished_fuel_transfer_mode_seeder import (
    seed_finished_fuel_transfer_modes,
)
from lcfs.db.seeders.dev.feedstock_fuel_transfer_mode_seeder import (
    seed_feedstock_fuel_transfer_modes,
)
from lcfs.db.seeders.dev.notification_channel_subscription_seeder import (
    seed_notification_channel_subscriptions,
)
from lcfs.db.seeders.seed_charging_power_output import seed_charging_power_output
from lcfs.db.seeders.staging.test_allocation_agreement_seeder import (
    seed_test_allocation_agreements,
)
from lcfs.db.seeders.staging.test_charging_equipment_seeder import (
    seed_test_charging_equipment,
)
from lcfs.db.seeders.staging.test_charging_site_seeder import (
    seed_test_charging_sites,
)
from lcfs.db.seeders.staging.test_compliance_report_history_seeder import (
    seed_test_compliance_report_history,
)
from lcfs.db.seeders.staging.test_compliance_report_organization_snapshot_seeder import (
    seed_test_compliance_report_organization_snapshots,
)
from lcfs.db.seeders.staging.test_compliance_report_seeder import (
    seed_test_compliance_reports,
)
from lcfs.db.seeders.staging.test_compliance_report_summary_seeder import (
    seed_test_compliance_report_summaries,
)
from lcfs.db.seeders.staging.test_document_seeder import seed_test_documents
from lcfs.db.seeders.staging.test_fuel_code_seeder import seed_test_fuel_codes
from lcfs.db.seeders.staging.test_fuel_export_seeder import seed_test_fuel_exports
from lcfs.db.seeders.staging.test_fuel_supply_seeder import seed_test_fuel_supplies
from lcfs.db.seeders.staging.test_notional_transfer_seeder import (
    seed_test_notional_transfers,
)
from lcfs.db.seeders.staging.test_other_uses_seeder import seed_test_other_uses
from lcfs.db.seeders.staging.test_transfer_history_seeder import (
    seed_test_transfer_history,
)
from lcfs.db.seeders.staging.test_transfer_seeder import seed_test_transfers
from lcfs.db.seeders.staging.test_transaction_seeder import seed_test_transactions

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
        "compliance_report": "compliance_report_id",
        "compliance_report_summary": "summary_id",
        "compliance_report_organization_snapshot": "organization_snapshot_id",
        "fuel_supply": "fuel_supply_id",
        "fuel_export": "fuel_export_id",
        "notional_transfer": "notional_transfer_id",
        "other_uses": "other_uses_id",
        "allocation_agreement": "allocation_agreement_id",
        "compliance_report_history": "compliance_report_history_id",
        "charging_site": "charging_site_id",
        "charging_equipment": "charging_equipment_id",
        "document": "document_id",
        "transfer": "transfer_id",
        "transfer_history": "transfer_history_id",
    }

    for table, column in sequences.items():
        if table == "compliance_report_organization_snapshot":
            sequence_name = (
                "compliance_report_organization_sna_organization_snapshot_id_seq"
            )
        else:
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
    await seed_test_transactions(session)
    await seed_user_profiles(session)
    await seed_user_roles(session)
    await seed_admin_adjustments(session)
    await seed_test_fuel_codes(session)
    await seed_test_compliance_reports(session)
    await seed_test_compliance_report_organization_snapshots(session)
    await seed_test_compliance_report_summaries(session)
    await seed_test_fuel_supplies(session)
    await seed_test_fuel_exports(session)
    await seed_test_notional_transfers(session)
    await seed_test_other_uses(session)
    await seed_test_allocation_agreements(session)
    await seed_test_charging_sites(session)
    await seed_test_charging_equipment(session)
    await seed_test_documents(session)
    await seed_test_transfers(session)
    await seed_test_compliance_report_history(session)
    await seed_test_transfer_history(session)
    await seed_finished_fuel_transfer_modes(session)
    await seed_feedstock_fuel_transfer_modes(session)
    await seed_notification_channel_subscriptions(session)
    await seed_charging_power_output(session)

    # Update sequences after all seeders have run
    await update_sequences(session)

    # TODO not working with incorrect foreign keys, needs debugging
    # await seed_admin_adjustment_history(session)

    logger.info("Dev database seeding completed successfully.")


if __name__ == "__main__":
    asyncio.run(seed_dev())
