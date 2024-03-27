import logging
from sqlalchemy import select
from lcfs.db.models.AdminAdjustment import AdminAdjustment

logger = logging.getLogger(__name__)


async def seed_admin_adjustments(session):
    """
    Seeds initial admin adjustments into the database, if they do not already exist.
    Args:
        session: The database session for committing the new records.
    """

    admin_adjustments_to_seed = [
        {'compliance_units': 50000, 'to_organization_id': 1, 'transaction_id': 1},
        {'compliance_units': 50000, 'to_organization_id': 2, 'transaction_id': 2},
        {'compliance_units': 50000, 'to_organization_id': 3, 'transaction_id': 3},
        {'compliance_units': 50000, 'to_organization_id': 4, 'transaction_id': 4},
        {'compliance_units': 50000, 'to_organization_id': 5, 'transaction_id': 5},
        {'compliance_units': 50000, 'to_organization_id': 6, 'transaction_id': 6},
        {'compliance_units': 50000, 'to_organization_id': 7, 'transaction_id': 7},
        {'compliance_units': 50000, 'to_organization_id': 8, 'transaction_id': 8},
        {'compliance_units': 50000, 'to_organization_id': 9, 'transaction_id': 9},
        {'compliance_units': 50000, 'to_organization_id': 10, 'transaction_id': 10}
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

        await session.commit()
    except Exception as e:
        logger.error("Error occurred while seeding admin adjustments: %s", e)
        raise
