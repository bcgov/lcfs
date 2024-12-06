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
            "name": "BCEID__COMPLIANCE_REPORT__DIRECTOR_ASSESSMENT",
            "description": "Director assessed a compliance report or supplemental report.",
            "email_content": "Email content",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "BCEID__INITIATIVE_AGREEMENT__DIRECTOR_APPROVAL",
            "description": "Director approved the initiative agreement or transaction",
            "email_content": "Email content",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "BCEID__TRANSFER__DIRECTOR_DECISION",
            "description": "Director recorded or refused a transfer request",
            "email_content": "Email content",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "BCEID__TRANSFER__PARTNER_ACTIONS",
            "description": "A transfer partner took action (proposed, declined, rescinded, or signed & submitted) on a transfer request",
            "email_content": "Email content",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "IDIR_ANALYST__COMPLIANCE_REPORT__DIRECTOR_DECISION",
            "description": "Director assessed compliance report",
            "email_content": "Email content",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "IDIR_ANALYST__COMPLIANCE_REPORT__MANAGER_RECOMMENDATION",
            "description": "Compliance manager recommended action on the compliance report.",
            "email_content": "Email content",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "IDIR_ANALYST__COMPLIANCE_REPORT__SUBMITTED_FOR_REVIEW",
            "description": "Compliance report submitted for government analyst review or returned by compliance manager",
            "email_content": "Email content",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "IDIR_ANALYST__INITIATIVE_AGREEMENT__RETURNED_TO_ANALYST",
            "description": "Director approved/returned the initiative agreement to the analyst",
            "email_content": "Email content",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "IDIR_ANALYST__TRANSFER__DIRECTOR_RECORDED",
            "description": "Director recorded or refused a transfer request",
            "email_content": "Email content",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "IDIR_ANALYST__TRANSFER__RESCINDED_ACTION",
            "description": "A transfer request was rescinded by a transfer partner",
            "email_content": "Email content",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "IDIR_ANALYST__TRANSFER__SUBMITTED_FOR_REVIEW",
            "description": "Transfer request submitted for government analyst review",
            "email_content": "Email content",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "IDIR_COMPLIANCE_MANAGER__COMPLIANCE_REPORT__ANALYST_RECOMMENDATION",
            "description": "Analyst recommendation on the compliance report or returned by the director",
            "email_content": "Email content",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "IDIR_COMPLIANCE_MANAGER__COMPLIANCE_REPORT__DIRECTOR_ASSESSMENT",
            "description": "Director assessed a compliance report",
            "email_content": "Email content",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "IDIR_COMPLIANCE_MANAGER__COMPLIANCE_REPORT__SUBMITTED_FOR_REVIEW",
            "description": "Compliance report submitted for government analyst review",
            "email_content": "Email content",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "IDIR_DIRECTOR__COMPLIANCE_REPORT__MANAGER_RECOMMENDATION",
            "description": "Compliance manager recommended action on the compliance report",
            "email_content": "Email content",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "IDIR_DIRECTOR__INITIATIVE_AGREEMENT__ANALYST_RECOMMENDATION",
            "description": "Analyst recommendation provided for the initiative agreement",
            "email_content": "Email content",
            "create_user": "system",
            "update_user": "system",
        },
        {
            "name": "IDIR_DIRECTOR__TRANSFER__ANALYST_RECOMMENDATION",
            "description": "Analyst recommendation provided for the transfer request",
            "email_content": "Email content",
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
