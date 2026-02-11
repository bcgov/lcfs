import structlog
from sqlalchemy import select
from lcfs.db.models.compliance.FuelExport import FuelExport

logger = structlog.get_logger(__name__)


async def seed_test_fuel_exports(session):
    """
    Seeds the fuel exports into the database with comprehensive test data,
    if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    # Define the fuel exports to seed based on actual test database
    fuel_exports_to_seed = [
        {
            "fuel_export_id": 1,
            "compliance_report_id": 1,
            "fuel_type_id": 17,
            "fuel_category_id": 1,
            "end_use_id": 24,
            "provision_of_the_act_id": 2,  # "Fuel code - section 19 (b) (i)"
            "quantity": 15000,
            "units": "Litres",
            "compliance_units": 0.00000,
        },
        {
            "fuel_export_id": 2,
            "compliance_report_id": 1,
            "fuel_type_id": 16,
            "fuel_category_id": 2,
            "end_use_id": 24,
            "provision_of_the_act_id": 3,  # "Default carbon intensity - section 19 (b) (ii)"
            "quantity": 9500000,
            "units": "Litres",
            "compliance_units": 0.00000,
        },
    ]

    # Query all existing fuel exports at once to avoid autoflush issues
    result = await session.execute(select(FuelExport))
    existing_exports = result.scalars().all()
    existing_ids = {export.fuel_export_id for export in existing_exports}

    # Filter out fuel exports that already exist
    exports_to_add = []
    for fuel_export_data in fuel_exports_to_seed:
        if fuel_export_data["fuel_export_id"] not in existing_ids:
            exports_to_add.append(FuelExport(**fuel_export_data))

    # Add all new fuel exports at once
    if exports_to_add:
        session.add_all(exports_to_add)
        await session.flush()
        logger.info(f"Seeded {len(exports_to_add)} fuel exports.")
    else:
        logger.info("All fuel exports already exist, skipping.")
