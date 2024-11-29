import structlog
from sqlalchemy import select
from lcfs.db.models.notification.NotificationType import (
    NotificationType,
)

logger = structlog.get_logger(__name__)


async def seed_notification_types(session):
    """
    Seeds the notification types into the database.

    Args:
        session: The database session for committing the new records.
    """
    notification_types_to_seed = [
        {
            "notification_type_id": 1,
            "name": "BCEID__CR__DIRECTOR_ASSESSMENT",
            "description": "Director assessment",
        },
        {
            "notification_type_id": 2,
            "name": "BCEID__IA__DIRECTOR_APPROVAL",
            "description": "Director approved",
        },
        {
            "notification_type_id": 3,
            "name": "BCEID__TR__DIRECTOR_DECISION",
            "description": "Director recorded/refused",
        },
        {
            "notification_type_id": 4,
            "name": "BCEID__TR__PARTNER_ACTIONS",
            "description": "Transfer partner proposed, declined, rescinded or signed & submitted",
        },
        {
            "notification_type_id": 5,
            "name": "IDIR_A__CR__DIRECTOR_DECISION",
            "description": "Director assessment",
        },
        {
            "notification_type_id": 6,
            "name": "IDIR_A__CR__MANAGER_RECOMMENDATION",
            "description": "Recommended by compliance manager",
        },
        {
            "notification_type_id": 7,
            "name": "IDIR_A__CR__SUBMITTED_FOR_REVIEW",
            "description": "Submitted to government for analyst review (or returned by compliance manager)",
        },
        {
            "notification_type_id": 8,
            "name": "IDIR_A__IA__RETURNED_TO_ANALYST",
            "description": "Director approved/returned to analyst",
        },
        {
            "notification_type_id": 9,
            "name": "IDIR_A__TR__DIRECTOR_RECORDED",
            "description": "Director recorded/refused",
        },
        {
            "notification_type_id": 10,
            "name": "IDIR_A__TR__RESCINDED_ACTION",
            "description": "Rescinded by either transfer partner",
        },
        {
            "notification_type_id": 11,
            "name": "IDIR_A__TR__SUBMITTED_FOR_REVIEW",
            "description": "Submitted to government for analyst review",
        },
        {
            "notification_type_id": 12,
            "name": "IDIR_CM__CR__ANALYST_RECOMMENDATION",
            "description": "Analyst recommendation (or returned by the director)",
        },
        {
            "notification_type_id": 13,
            "name": "IDIR_CM__CR__DIRECTOR_ASSESSMENT",
            "description": "Director assessment",
        },
        {
            "notification_type_id": 14,
            "name": "IDIR_CM__CR__SUBMITTED_FOR_REVIEW",
            "description": "Submitted to government for analyst review",
        },
        {
            "notification_type_id": 15,
            "name": "IDIR_D__CR__MANAGER_RECOMMENDATION",
            "description": "Compliance manager recommendation",
        },
        {
            "notification_type_id": 16,
            "name": "IDIR_D__IA__ANALYST_RECOMMENDATION",
            "description": "Analyst recommendation",
        },
        {
            "notification_type_id": 17,
            "name": "IDIR_D__TR__ANALYST_RECOMMENDATION",
            "description": "Analyst recommendation",
        },
    ]

    try:
        for type_data in notification_types_to_seed:
            exists = await session.execute(
                select(NotificationType).where(
                    NotificationType.notification_type_id
                    == type_data["notification_type_id"]
                )
            )
            if not exists.scalars().first():
                notification_type = NotificationType(**type_data)
                session.add(notification_type)

    except Exception as e:
        context = {
            "function": "seed_notification_types",
        }
        logger.error(
            "Error occurred while seeding notification types",
            error=str(e),
            exc_info=e,
            **context,
        )
        raise
