import structlog
from sqlalchemy import select
from lcfs.db.models.notification.GovernmentNotification import (
    GovernmentNotification,
    NotificationTypeEnum,
)

logger = structlog.get_logger(__name__)


async def seed_test_government_notification(session):
    """
    Seeds a government notification into the database,
    if it does not already exist.

    Args:
        session: The database session for committing the new records.
    """

    # Check if a notification already exists (single record table)
    existing_notification = await session.execute(
        select(GovernmentNotification).limit(1)
    )
    if existing_notification.scalar():
        logger.info("Government notification already exists, skipping.")
        return

    # Define the default government notification
    notification_data = {
        "notification_title": "New credit trading market",
        "notification_text": "<p>Bulletin 13 has been replaced by a new internal feature.</p>",
        "link_url": "https://lcfs-test.apps.silver.devops.gov.bc.ca/transactions?tab=credit-trading-market",
        "notification_type": NotificationTypeEnum.GENERAL,
    }

    # Create and add the new notification
    notification = GovernmentNotification(**notification_data)
    session.add(notification)

    await session.flush()
    logger.info("Seeded government notification successfully.")
