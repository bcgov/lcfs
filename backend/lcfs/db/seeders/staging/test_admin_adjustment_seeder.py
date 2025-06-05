import structlog
from datetime import datetime
from sqlalchemy import select
from lcfs.db.models.admin_adjustment import AdminAdjustment

logger = structlog.get_logger(__name__)


async def seed_test_admin_adjustments(session):
    """
    Seeds admin adjustments into the database with comprehensive test data,
    if they do not already exist.
    Args:
        session: The database session for committing the new records.
    """

    # Define the admin adjustments to seed based on actual test database
    admin_adjustments_to_seed = [
        {
            "admin_adjustment_id": 1,
            "compliance_units": 50000,
            "to_organization_id": 1,
            "transaction_id": 1,
            "current_status_id": 3,
        },
        {
            "admin_adjustment_id": 2,
            "compliance_units": 50000,
            "to_organization_id": 2,
            "transaction_id": 2,
            "current_status_id": 3,
        },
        {
            "admin_adjustment_id": 3,
            "compliance_units": 50000,
            "to_organization_id": 3,
            "transaction_id": 3,
            "current_status_id": 3,
        },
        {
            "admin_adjustment_id": 4,
            "compliance_units": 50000,
            "to_organization_id": 4,
            "transaction_id": 4,
            "current_status_id": 3,
        },
        {
            "admin_adjustment_id": 5,
            "compliance_units": 50000,
            "to_organization_id": 5,
            "transaction_id": 5,
            "current_status_id": 3,
        },
        {
            "admin_adjustment_id": 6,
            "compliance_units": 50000,
            "to_organization_id": 6,
            "transaction_id": 6,
            "current_status_id": 3,
        },
        {
            "admin_adjustment_id": 7,
            "compliance_units": 50000,
            "to_organization_id": 7,
            "transaction_id": 7,
            "current_status_id": 3,
        },
        {
            "admin_adjustment_id": 8,
            "compliance_units": 50000,
            "to_organization_id": 8,
            "transaction_id": 8,
            "current_status_id": 3,
        },
        {
            "admin_adjustment_id": 9,
            "compliance_units": 50000,
            "to_organization_id": 9,
            "transaction_id": 9,
            "current_status_id": 3,
        },
        {
            "admin_adjustment_id": 10,
            "compliance_units": 50000,
            "to_organization_id": 10,
            "transaction_id": 10,
            "current_status_id": 3,
        },
    ]

    for admin_adjustment_data in admin_adjustments_to_seed:
        # Check if the admin adjustment already exists
        existing_admin_adjustment = await session.execute(
            select(AdminAdjustment).where(
                AdminAdjustment.admin_adjustment_id
                == admin_adjustment_data["admin_adjustment_id"]
            )
        )
        if existing_admin_adjustment.scalar():
            logger.info(
                f"Admin adjustment with ID {admin_adjustment_data['admin_adjustment_id']} already exists, skipping."
            )
            continue

        # Create and add the new admin adjustment
        admin_adjustment = AdminAdjustment(**admin_adjustment_data)
        session.add(admin_adjustment)

    await session.flush()
    logger.info(f"Seeded {len(admin_adjustments_to_seed)} admin adjustments.")
