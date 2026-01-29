import structlog
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from lcfs.db.seeders.staging.test_admin_adjustment_seeder import (
    seed_test_admin_adjustments,
)
from lcfs.db.seeders.staging.test_organization_seeder import seed_test_organizations
from lcfs.db.seeders.staging.test_organization_address_seeder import (
    seed_test_organization_addresses,
)
from lcfs.db.seeders.staging.test_organization_attorney_address_seeder import (
    seed_test_organization_attorney_addresses,
)
from lcfs.db.seeders.staging.test_user_profile_seeder import seed_test_user_profiles
from lcfs.db.seeders.staging.test_user_role_seeder import seed_test_user_roles
from lcfs.db.seeders.staging.test_transaction_seeder import seed_test_transactions
from lcfs.db.seeders.staging.test_transfer_seeder import seed_test_transfers
from lcfs.db.seeders.staging.test_compliance_report_seeder import (
    seed_test_compliance_reports,
)
from lcfs.db.seeders.staging.test_compliance_report_summary_seeder import (
    seed_test_compliance_report_summaries,
)
from lcfs.db.seeders.staging.test_compliance_report_organization_snapshot_seeder import (
    seed_test_compliance_report_organization_snapshots,
)
from lcfs.db.seeders.staging.test_fuel_supply_seeder import seed_test_fuel_supplies
from lcfs.db.seeders.staging.test_fuel_export_seeder import seed_test_fuel_exports
from lcfs.db.seeders.staging.test_notional_transfer_seeder import (
    seed_test_notional_transfers,
)
from lcfs.db.seeders.staging.test_fuel_code_seeder import seed_test_fuel_codes
from lcfs.db.seeders.staging.test_compliance_report_history_seeder import (
    seed_test_compliance_report_history,
)
from lcfs.db.seeders.staging.test_transfer_history_seeder import (
    seed_test_transfer_history,
)
from lcfs.db.seeders.staging.test_other_uses_seeder import seed_test_other_uses
from lcfs.db.seeders.staging.test_allocation_agreement_seeder import (
    seed_test_allocation_agreements,
)
from lcfs.db.seeders.staging.test_final_supply_equipment_seeder import (
    seed_test_final_supply_equipment,
)
from lcfs.db.seeders.staging.test_charging_site_seeder import (
    seed_test_charging_sites,
)
from lcfs.db.seeders.staging.test_document_seeder import (
    seed_test_documents,
)
from lcfs.db.seeders.staging.test_government_notification_seeder import (
    seed_test_government_notification,
)

logger = structlog.get_logger(__name__)


async def update_sequences(session: AsyncSession):
    """
    Function to update sequences for all tables after seeding.
    """
    sequences = {
        "organization": "organization_id",
        "organization_address": "organization_address_id",
        "organization_attorney_address": "organization_attorney_address_id",
        "user_profile": "user_profile_id",
        "user_role": "user_role_id",
        "transaction": "transaction_id",
        "admin_adjustment": "admin_adjustment_id",
        "transfer": "transfer_id",
        "compliance_report": "compliance_report_id",
        "compliance_report_summary": "summary_id",
        "compliance_report_organization_snapshot": "organization_snapshot_id",
        "fuel_supply": "fuel_supply_id",
        "fuel_export": "fuel_export_id",
        "notional_transfer": "notional_transfer_id",
        "fuel_code": "fuel_code_id",
        "compliance_report_history": "compliance_report_history_id",
        "transfer_history": "transfer_history_id",
        "other_uses": "other_uses_id",
        "allocation_agreement": "allocation_agreement_id",
        "charging_site": "charging_site_id",
        "final_supply_equipment": "final_supply_equipment_id",
        "document": "document_id",
        "government_notification": "government_notification_id",
        # Add other tables and their primary key columns as needed
    }

    for table, column in sequences.items():
        # Special cases for tables with non-standard sequence names
        if table == "organization_attorney_address":
            sequence_name = (
                "organization_attorney_address_organization_attorney_address_seq"
            )
        elif table == "compliance_report_organization_snapshot":
            # PostgreSQL truncated the table name in the sequence due to identifier length limits
            sequence_name = (
                "compliance_report_organization_sna_organization_snapshot_id_seq"
            )
        else:
            sequence_name = f"{table}_{column}_seq"

        max_value_query = text(
            f"SELECT setval('{sequence_name}', COALESCE((SELECT MAX({column}) + 1 FROM {table}), 1), false)"
        )
        await session.execute(max_value_query)


async def seed_staging(session: AsyncSession):
    """
    Function to seed the database with staging data.
    """
    # Seed addresses first (organizations will reference these)
    await seed_test_organization_addresses(session)
    await seed_test_organization_attorney_addresses(session)

    # Seed organizations after addresses (with address foreign keys)
    await seed_test_organizations(session)

    # Seed user-related entities
    await seed_test_user_profiles(session)
    await seed_test_user_roles(session)
    await seed_test_transactions(session)

    # Seed fuel codes before fuel supplies (dependency)
    await seed_test_fuel_codes(session)

    # Seed compliance-related entities
    await seed_test_compliance_reports(session)
    await seed_test_compliance_report_organization_snapshots(session)
    await seed_test_compliance_report_summaries(session)
    await seed_test_fuel_supplies(session)
    await seed_test_fuel_exports(session)
    await seed_test_notional_transfers(session)
    await seed_test_other_uses(session)
    await seed_test_allocation_agreements(session)
    await seed_test_charging_sites(session)
    await seed_test_final_supply_equipment(session)

    # Seed documents after compliance reports (dependency)
    await seed_test_documents(session)

    # Seed transfers and adjustments
    await seed_test_transfers(session)
    await seed_test_admin_adjustments(session)

    # Seed history records after main entities
    await seed_test_compliance_report_history(session)
    await seed_test_transfer_history(session)

    # Seed government notification (standalone table)
    await seed_test_government_notification(session)

    # Update sequences after all seeders have run
    await update_sequences(session)

    logger.info("Staging database seeding completed successfully.")


if __name__ == "__main__":
    asyncio.run(seed_staging())
