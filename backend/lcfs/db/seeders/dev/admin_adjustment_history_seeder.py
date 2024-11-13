import structlog
from sqlalchemy import select, and_
from lcfs.db.models.admin_adjustment import AdminAdjustmentHistory

logger = structlog.get_logger(__name__)


async def seed_admin_adjustment_history(session):
    """
    Seeds initial admin adjustment hustory records into the database, if they do not already exist.
    Args:
        session: The database session for committing the new records.
    """

    admin_adjustment_history_to_seed = [
        {
            "admin_adjustment_id": i,
            "admin_adjustment_status_id": status_id,  # Recommended or Approved
            "effective_status": True,
            "user_profile_id": 18,  # Al Ring
        }
        for i in range(1, 11)
        for status_id in (2, 3)  # 2: Recommended, 3: Approved
    ]

    try:
        for admin_adjustment_history_data in admin_adjustment_history_to_seed:
            # Check if the admin adjustment history already exists with the same admin_adjustment_id and admin_adjustment_status_id
            exists = await session.execute(
                select(AdminAdjustmentHistory).where(
                    and_(
                        AdminAdjustmentHistory.admin_adjustment_id == admin_adjustment_history_data["admin_adjustment_id"],
                        AdminAdjustmentHistory.admin_adjustment_status_id == admin_adjustment_history_data["admin_adjustment_status_id"]
                    )
                )
            )

            if not exists.scalars().first():
                admin_adjustment_history = AdminAdjustmentHistory(**admin_adjustment_history_data)
                session.add(admin_adjustment_history)

    except Exception as e:
        context = {
            "function": "seed_admin_adjustment_history",
        }
        logger.error(
            "Error occurred while seeding admin adjustments",
            error=str(e),
            exc_info=e,
            **context,
        )
        raise
