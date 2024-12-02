import structlog
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from lcfs.db.models.notification.NotificationChannel import NotificationChannel
from lcfs.db.models.notification.NotificationType import NotificationType

logger = structlog.get_logger(__name__)


async def seed_notification_channels(session):
    """
    Seeds the notification_channel table with predefined values if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """
    channels_to_seed = [
        {"channel_name": "EMAIL", "enabled": True, "subscribe_by_default": True},
        {"channel_name": "IN_APP", "enabled": True, "subscribe_by_default": False},
    ]

    try:
        for channel_data in channels_to_seed:
            # Check if the NotificationChannel already exists
            exists = await session.execute(
                select(NotificationChannel).where(
                    NotificationChannel.channel_name == channel_data["channel_name"]
                )
            )
            if not exists.scalars().first():
                channel = NotificationChannel(**channel_data)
                session.add(channel)
    except IntegrityError as ie:
        logger.warning(
            "Integrity error while seeding notification_channel",
            error=str(ie),
            exc_info=ie,
        )
    except Exception as e:
        context = {
            "function": "seed_notification_channels",
        }
        logger.error(
            "Error occurred while seeding notification_channel",
            error=str(e),
            exc_info=e,
            **context,
        )
        raise


async def seed_notification_types(session):
    """
    Seeds the notification_type table with predefined values if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """
    types_to_seed = [
        {
            "name": "BCEID__CR__DIRECTOR_ASSESSMENT",
            "description": "Director assessment",
            "email_content": "Email content for director assessment",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "BCEID__IA__DIRECTOR_APPROVAL",
            "description": "Director approved",
            "email_content": "Email content for director approval",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "BCEID__TR__DIRECTOR_DECISION",
            "description": "Director recorded/refused",
            "email_content": "Email content for director decision",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "BCEID__TR__PARTNER_ACTIONS",
            "description": "Transfer partner proposed, declined, rescinded or signed & submitted",
            "email_content": "Email content for partner actions",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "IDIR_A__CR__DIRECTOR_DECISION",
            "description": "Director assessment",
            "email_content": "Email content for director assessment",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "IDIR_A__CR__MANAGER_RECOMMENDATION",
            "description": "Recommended by compliance manager",
            "email_content": "Email content for manager recommendation",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "IDIR_A__CR__SUBMITTED_FOR_REVIEW",
            "description": "Submitted to government for analyst review (or returned by compliance manager)",
            "email_content": "Email content for submission review",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "IDIR_A__IA__RETURNED_TO_ANALYST",
            "description": "Director approved/returned to analyst",
            "email_content": "Email content for return to analyst",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "IDIR_A__TR__DIRECTOR_RECORDED",
            "description": "Director recorded/refused",
            "email_content": "Email content for director recorded",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "IDIR_A__TR__RESCINDED_ACTION",
            "description": "Rescinded by either transfer partner",
            "email_content": "Email content for rescinded action",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "IDIR_A__TR__SUBMITTED_FOR_REVIEW",
            "description": "Submitted to government for analyst review",
            "email_content": "Email content for submission review",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "IDIR_CM__CR__ANALYST_RECOMMENDATION",
            "description": "Analyst recommendation (or returned by the director)",
            "email_content": "Email content for analyst recommendation",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "IDIR_CM__CR__DIRECTOR_ASSESSMENT",
            "description": "Director assessment",
            "email_content": "Email content for director assessment",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "IDIR_CM__CR__SUBMITTED_FOR_REVIEW",
            "description": "Submitted to government for analyst review",
            "email_content": "Email content for submission review",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "IDIR_D__CR__MANAGER_RECOMMENDATION",
            "description": "Compliance manager recommendation",
            "email_content": "Email content for manager recommendation",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "IDIR_D__IA__ANALYST_RECOMMENDATION",
            "description": "Analyst recommendation",
            "email_content": "Email content for analyst recommendation",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "IDIR_D__TR__ANALYST_RECOMMENDATION",
            "description": "Analyst recommendation",
            "email_content": "Email content for analyst recommendation",
            "create_user": "system",
            "update_user": "system",
        },
    ]

    try:
        for notification_type_data in types_to_seed:
            # Check if the NotificationType already exists
            exists = await session.execute(
                select(NotificationType).where(
                    NotificationType.name == notification_type_data["name"]
                )
            )
            if not exists.scalars().first():
                notification_type = NotificationType(**notification_type_data)
                session.add(notification_type)
    except IntegrityError as ie:
        logger.warning(
            "Integrity error while seeding notification_type",
            error=str(ie),
            exc_info=ie,
        )
    except Exception as e:
        context = {
            "function": "seed_notification_types",
        }
        logger.error(
            "Error occurred while seeding notification_type",
            error=str(e),
            exc_info=e,
            **context,
        )
        raise
