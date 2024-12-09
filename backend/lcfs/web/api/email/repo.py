from lcfs.db.models.notification import NotificationChannelSubscription
from lcfs.db.models.notification import NotificationType
from lcfs.db.models.notification.NotificationChannel import (
    ChannelEnum,
    NotificationChannel,
)
from lcfs.web.core.decorators import repo_handler
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, or_
from typing import List
from lcfs.db.models.user import UserProfile
from lcfs.db.dependencies import get_async_db_session
from fastapi import Depends


class CHESEmailRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_subscribed_user_emails(
        self, notification_type: str, organization_id: int
    ) -> List[str]:
        """
        Retrieve emails of users subscribed to a specific notification type and for the Email channel.
        Ignores In-Application notification types.
        """
        query = (
            select(
                func.coalesce(UserProfile.notifications_email, UserProfile.email).label("email")
            )
            .join(NotificationChannelSubscription)
            .join(NotificationChannelSubscription.notification_channel)
            .filter(
                NotificationChannelSubscription.notification_type.has(
                    name=notification_type
                ),
                NotificationChannelSubscription.is_enabled == True,
                NotificationChannel.channel_name
                == ChannelEnum.EMAIL,  # Only Email channel
                or_(
                    UserProfile.organization_id == organization_id,
                    UserProfile.organization_id.is_(None),  # Include government users
                ),
            )
        )
        result = await self.db.execute(query)
        return [row[0] for row in result.fetchall()]

    @repo_handler
    async def get_notification_template(self, notification_type: str) -> str:
        """
        Retrieve the email template for a specific notification type.
        """
        # Query to fetch NotificationType.email_content via explicit join
        query = (
            select(NotificationType.email_content)
            .join(
                NotificationChannelSubscription,
                NotificationChannelSubscription.notification_type_id
                == NotificationType.notification_type_id,
            )
            .filter(NotificationType.name == notification_type)
            .limit(1)  # Fetch only one record
        )

        # Execute the query
        result = await self.db.execute(query)
        template = result.scalar_one_or_none()
        return template or "default.html"
