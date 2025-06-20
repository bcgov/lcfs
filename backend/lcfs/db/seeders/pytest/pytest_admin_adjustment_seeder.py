import structlog
from datetime import datetime
from sqlalchemy import select
from lcfs.db.models.admin_adjustment import AdminAdjustment

logger = structlog.get_logger(__name__)


async def seed_pytest_admin_adjustments(session):
    """
    Seeds initial admin adjustments into the database, if they do not already exist.
    Args:
        session: The database session for committing the new records.
    """

    # Define a standard date for transaction_effective_date
    transaction_effective_date = datetime(2024, 1, 1)

    admin_adjustments_to_seed = [
        {
            "compliance_units": 50000,
            "to_organization_id": 1,
            "transaction_id": 1,
            "current_status_id": 1,
            "transaction_effective_date": transaction_effective_date,
        },
        {
            "compliance_units": 50000,
            "to_organization_id": 1,
            "transaction_id": 2,
            "current_status_id": 3,
            "transaction_effective_date": transaction_effective_date,
        },
    ]

    try:
        for admin_adjustment_data in admin_adjustments_to_seed:
            # Check if the admin adjustment already exists
            exists = await session.execute(
                select(AdminAdjustment).where(
                    AdminAdjustment.transaction_id
                    == admin_adjustment_data["transaction_id"]
                )
            )
            if not exists.scalars().first():
                admin_adjustment = AdminAdjustment(**admin_adjustment_data)
                session.add(admin_adjustment)

    except Exception as e:
        context = {
            "function": "seed_pytest_admin_adjustments",
        }
        logger.error(
            "Error occurred while seeding admin adjustments",
            error=str(e),
            exc_info=e,
            **context,
        )
        raise
