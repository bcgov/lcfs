import logging
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

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
from lcfs.db.seeders.common.allocation_agreement_seeder import seed_allocation_transaction_types

logger = logging.getLogger(__name__)

async def update_sequences(session):
    """
    Function to update sequences for all tables after seeding.
    """
    sequences = {
        'fuel_code': 'fuel_code_id',
        'transport_mode': 'transport_mode_id',
        'provision_of_the_act': 'provision_of_the_act_id',
        'fuel_type': 'fuel_type_id',
        'fuel_code_prefix': 'fuel_code_prefix_id',
        'fuel_code_status': 'fuel_code_status_id',
        'fuel_category': 'fuel_category_id',
        'end_use_type': 'end_use_type_id',
        'unit_of_measure': 'uom_id',
        'additional_carbon_intensity': 'additional_uci_id',
        'energy_effectiveness_ratio': 'eer_id',
        'energy_density': 'energy_density_id',
        'target_carbon_intensity': 'target_carbon_intensity_id',
        'compliance_report_status': 'compliance_report_status_id',
        'admin_adjustment_status': 'admin_adjustment_status_id',
        'compliance_period': 'compliance_period_id',
        'initiative_agreement_status': 'initiative_agreement_status_id',
        'organization_status': 'organization_status_id',
        'organization_type': 'organization_type_id',
        'transfer_category': 'transfer_category_id',
        'transfer_status': 'transfer_status_id',
        'role': 'role_id',
    }

    for table, column in sequences.items():
        sequence_name = f"{table}_{column}_seq"
        max_value_query = text(f"SELECT setval('{sequence_name}', COALESCE((SELECT MAX({column}) + 1 FROM {table}), 1), false)")
        await session.execute(max_value_query)

async def seed_common(session: AsyncSession):
    """
    Function to seed the database with common data.
    """
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
    await seed_allocation_transaction_types(session)
    
    # Update sequences after all seeders have run
    await update_sequences(session)
    
    logger.info("Common database seeding completed successfully.")

if __name__ == "__main__":
    asyncio.run(seed_common())
