from lcfs.db.models.notification import NotificationChannelSubscription
from lcfs.db.models.notification import NotificationType
from lcfs.db.models.notification.NotificationChannel import (
    ChannelEnum,
    NotificationChannel,
)
from lcfs.web.api.base import AudienceType
from lcfs.web.core.decorators import repo_handler
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, or_, and_
from typing import List
from lcfs.db.models.user import UserProfile
from lcfs.db.dependencies import get_async_db_session
from fastapi import Depends


class CHESEmailRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_subscribed_user_emails(
        self, notification_type: str, organization_id: int = None, audience_type: AudienceType = AudienceType.SAME_ORGANIZATION
    ) -> List[str]:
        """
        Retrieve emails of users subscribed to a specific notification type and for the Email channel.
        Uses the same logic as the notification repository but returns emails directly.
        """
        # Import locally to avoid circular import
        from lcfs.db.models.user.UserProfile import UserProfile
        
        query = (
            select(UserProfile.email)
            .join(
                NotificationChannelSubscription,
                NotificationChannelSubscription.user_profile_id == UserProfile.user_profile_id,
            )
            .join(
                NotificationType,
                NotificationType.notification_type_id == NotificationChannelSubscription.notification_type_id,
            )
            .join(
                NotificationChannel,
                NotificationChannel.notification_channel_id == NotificationChannelSubscription.notification_channel_id,
            )
            .filter(
                NotificationType.name == notification_type,
                NotificationChannelSubscription.is_enabled == True,
                NotificationChannel.channel_name == ChannelEnum.EMAIL.value,
            )
        )
        
        # Apply organization filtering based on audience type
        if organization_id is not None or audience_type in [AudienceType.GOVERNMENT_ONLY, AudienceType.OTHER_ORGANIZATIONS]:
            if audience_type == AudienceType.OTHER_ORGANIZATIONS:
                # Notify all other organizations (exclude posting org + government)
                query = query.filter(
                    and_(
                        UserProfile.organization_id != organization_id,  # Exclude posting org
                        UserProfile.organization_id.is_not(None),       # Exclude government users
                    )
                )
            elif audience_type == AudienceType.GOVERNMENT_ONLY:
                # Notify only government users
                query = query.filter(UserProfile.organization_id.is_(None))
            elif audience_type == AudienceType.ALL_EXCEPT_POSTING_ORG:
                # Notify everyone except the posting organization
                query = query.filter(UserProfile.organization_id != organization_id)
            else:  # AudienceType.SAME_ORGANIZATION (default)
                # Notify the specific organization + government users
                query = query.filter(
                    or_(
                        UserProfile.organization_id == organization_id,
                        UserProfile.organization_id.is_(None),  # Include government users
                    )
                )
        
        result = await self.db.execute(query)
        emails = [row[0] for row in result.fetchall() if row[0]]  # Filter out None emails
        return emails

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
