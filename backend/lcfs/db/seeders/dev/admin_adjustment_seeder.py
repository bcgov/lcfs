import logging
from datetime import datetime
from sqlalchemy import select
from lcfs.db.models.admin_adjustment import AdminAdjustment

logger = logging.getLogger(__name__)


async def seed_admin_adjustments(session):
    """
    Seeds initial admin adjustments into the database, if they do not already exist.
    Args:
        session: The database session for committing the new records.
    """

    # Define a standard date for transaction_effective_date
    transaction_effective_date = datetime(2023, 1, 1)

    admin_adjustments_to_seed = [
        {'compliance_units': 50000, 'to_organization_id': 1, 'transaction_id': 1, 'current_status_id': 3, 'transaction_effective_date': transaction_effective_date},
        {'compliance_units': 50000, 'to_organization_id': 2, 'transaction_id': 2, 'current_status_id': 3, 'transaction_effective_date': transaction_effective_date},
        {'compliance_units': 50000, 'to_organization_id': 3, 'transaction_id': 3, 'current_status_id': 3, 'transaction_effective_date': transaction_effective_date},
        {'compliance_units': 50000, 'to_organization_id': 4, 'transaction_id': 4, 'current_status_id': 3, 'transaction_effective_date': transaction_effective_date},
        {'compliance_units': 50000, 'to_organization_id': 5, 'transaction_id': 5, 'current_status_id': 3, 'transaction_effective_date': transaction_effective_date},
        {'compliance_units': 50000, 'to_organization_id': 6, 'transaction_id': 6, 'current_status_id': 3, 'transaction_effective_date': transaction_effective_date},
        {'compliance_units': 50000, 'to_organization_id': 7, 'transaction_id': 7, 'current_status_id': 3, 'transaction_effective_date': transaction_effective_date},
        {'compliance_units': 50000, 'to_organization_id': 8, 'transaction_id': 8, 'current_status_id': 3, 'transaction_effective_date': transaction_effective_date},
        {'compliance_units': 50000, 'to_organization_id': 9, 'transaction_id': 9, 'current_status_id': 3, 'transaction_effective_date': transaction_effective_date},
        {'compliance_units': 50000, 'to_organization_id': 10, 'transaction_id': 10, 'current_status_id': 3, 'transaction_effective_date': transaction_effective_date}
    ]

    try:
        for admin_adjustment_data in admin_adjustments_to_seed:
            # Check if the admin adjustment already exists
            exists = await session.execute(
                select(AdminAdjustment).where(
                    AdminAdjustment.transaction_id ==
                    admin_adjustment_data["transaction_id"]
                )
            )
            if not exists.scalars().first():
                admin_adjustment = AdminAdjustment(**admin_adjustment_data)
                session.add(admin_adjustment)

    except Exception as e:
        logger.error("Error occurred while seeding admin adjustments: %s", e)
        raise
