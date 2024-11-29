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
            "name": "TRANSFER_PARTNER_UPDATE",
            "description": "Transfer partner update notification",
            "email_content": "Email content for transfer partner update",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "TRANSFER_DIRECTOR_REVIEW",
            "description": "Director review notification",
            "email_content": "Email content for director review",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "INITIATIVE_APPROVED",
            "description": "Initiative approved notification",
            "email_content": "Email content for initiative approval",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "INITIATIVE_DA_REQUEST",
            "description": "DA request notification",
            "email_content": "Email content for DA request",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "SUPPLEMENTAL_REQUESTED",
            "description": "Supplemental requested notification",
            "email_content": "Email content for supplemental request",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "DIRECTOR_ASSESSMENT",
            "description": "Director assessment notification",
            "email_content": "Email content for director assessment",
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
