import logging
from sqlalchemy import select
from lcfs.db.models.admin_adjustment.AdminAdjustmentStatus import AdminAdjustmentStatus, AdminAdjustmentStatusEnum

logger = logging.getLogger(__name__)


async def seed_admin_adjustment_statuses(session):
    """
    Seeds the admin adjustment statuses into the database, if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """
    admin_adjustment_statuses_to_seed = [
        {
            "admin_adjustment_status_id": 1,
            "status": AdminAdjustmentStatusEnum.Draft,
        },
        {
            "admin_adjustment_status_id": 2,
            "status": AdminAdjustmentStatusEnum.Recommended,
        },
        {
            "admin_adjustment_status_id": 3,
            "status": AdminAdjustmentStatusEnum.Approved,
        },
        {
            "admin_adjustment_status_id": 4,
            "status": AdminAdjustmentStatusEnum.Deleted,
        },
    ]

    try:
        for status_data in admin_adjustment_statuses_to_seed:
            exists = await session.execute(
                select(AdminAdjustmentStatus).where(
                    AdminAdjustmentStatus.status == status_data["status"])
            )
            if not exists.scalars().first():
                status = AdminAdjustmentStatus(**status_data)
                session.add(status)

        await session.commit()
    except Exception as e:
        logger.error(
            "Error occurred while seeding admin adjustment statuses: %s", e)
        await session.rollback()
        raise
