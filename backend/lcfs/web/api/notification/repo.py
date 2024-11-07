from lcfs.db.models.notification import (
    NotificationChannelSubscription,
    NotificationMessage,
)
from lcfs.web.api.notification.schema import NotificationMessageSchema
import structlog
from datetime import date
from typing import List, Dict, Any, Optional, Union
from fastapi import Depends
from lcfs.db.dependencies import get_async_db_session
from lcfs.web.exception.exceptions import DataNotFoundException

from sqlalchemy import and_, delete, or_, select, func, text, update, distinct
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, contains_eager, selectinload
from sqlalchemy.exc import NoResultFound
from fastapi import HTTPException

from lcfs.web.core.decorators import repo_handler

logger = structlog.get_logger(__name__)


class NotificationRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def create_notification_message(
        self, notification_message: NotificationMessage
    ) -> NotificationMessage:
        """
        Create a new notification message
        """
        self.db.add(notification_message)
        await self.db.flush()
        await self.db.refresh(
            notification_message,
            [
                "related_organization",
                "origin_user_profile_id",
                "related_user_profile_id",
                "notification_type",
            ],
        )
        # await self.db.refresh(notification_message)
        return notification_message

    @repo_handler
    async def get_notification_messages_by_user(
        self, user_profile_id: int, is_read: Optional[bool] = None
    ) -> list[NotificationMessage]:
        """
        Retrieve all notification messages for a user
        """
        # Start building the query
        query = select(NotificationMessage).where(
            NotificationMessage.related_user_profile_id == user_profile_id
        )

        # Apply additional filter for `is_read` if provided
        if is_read is not None:
            query = query.where(NotificationMessage.is_read == is_read)

        # Execute the query and retrieve the results
        result = await self.db.execute(query)
        return result.scalars().all()

    @repo_handler
    async def get_notification_message_by_id(
        self, notification_id: int
    ) -> Optional[NotificationMessage]:
        """
        Retrieve notification message by id
        """
        query = select(NotificationMessage).where(
            (NotificationMessage.notification_message_id == notification_id)
        )
        result = await self.db.execute(query)
        notification = result.scalar_one()

        if not notification:
            raise DataNotFoundException(
                f"notification id '{notification_id}' not found"
            )

        return notification

    @repo_handler
    async def get_unread_notification_message_count_by_user_id(
        self, user_id: int
    ) -> int:
        """
        Retrieve count of unread notification message by user id
        """
        query = select(func.count(NotificationMessage.notification_message_id)).where(
            NotificationMessage.related_user_profile_id == user_id,
            NotificationMessage.is_read == False,
        )

        result = await self.db.execute(query)
        count = result.scalar_one()

        return count

    @repo_handler
    async def update_notification_message(self, notification) -> NotificationMessage:
        """
        Update a notification message
        """
        merged_notification = await self.db.merge(notification)
        await self.db.flush()

        return merged_notification

    @repo_handler
    async def delete_notification_message(self, notification_id: int):
        """
        Delete a notification_message by id
        """
        query = delete(NotificationMessage).where(
            NotificationMessage.notification_message_id == notification_id
        )
        await self.db.execute(query)
        await self.db.flush()

    @repo_handler
    async def mark_notification_as_read(
        self, notification_id
    ) -> Optional[NotificationMessage]:
        """
        Mark a notification message as read
        """
        query = select(NotificationMessage).where(
            NotificationMessage.notification_message_id == notification_id
        )
        result = await self.db.execute(query)
        notification = result.scalar_one_or_none()

        if notification:
            notification.is_read = True
            await self.db.commit()
            await self.db.refresh(notification)

        return notification

    @repo_handler
    async def create_notification_channel_subscription(
        self, notification_channel_subscription: NotificationChannelSubscription
    ) -> NotificationChannelSubscription:
        """
        Create a new notification channel subscription
        """
        self.db.add(notification_channel_subscription)
        await self.db.flush()
        await self.db.refresh(
            notification_channel_subscription,
            ["notification_type", "user_profile", "notification_channel"],
        )
        return notification_channel_subscription

    @repo_handler
    async def get_notification_channel_subscriptions_by_user(
        self, user_profile_id: int
    ) -> Optional[NotificationChannelSubscription]:
        """
        Retrieve channel subscriptions for a user
        """
        query = select(NotificationChannelSubscription).where(
            NotificationChannelSubscription.user_profile_id == user_profile_id
        )
        result = await self.db.execute(query)
        subscriptions = result.scalars().all()

        if not subscriptions:
            raise DataNotFoundException(
                f"Channel subscriptions not found for user id: '{user_profile_id}'"
            )

        return subscriptions

    @repo_handler
    async def get_notification_channel_subscription_by_id(
        self, notification_channel_subscription_id: int
    ) -> Optional[NotificationChannelSubscription]:
        """
        Retrieve a channel subscription by id
        """
        query = select(NotificationChannelSubscription).where(
            (
                NotificationChannelSubscription.notification_channel_subscription_id
                == notification_channel_subscription_id
            )
        )
        result = await self.db.execute(query)
        subscription = result.scalar_one()

        if not subscription:
            raise DataNotFoundException(
                f"Channel subscription with id '{notification_channel_subscription_id}'not found."
            )

        return subscription

    @repo_handler
    async def update_notification_channel_subscription(
        self, notification_channel_subscription: NotificationChannelSubscription
    ) -> NotificationChannelSubscription:
        """
        Update a notification chanel subscription
        """
        merged_subscription = await self.db.merge(notification_channel_subscription)
        await self.db.flush()

        return merged_subscription

    @repo_handler
    async def delete_notification_channel_subscription(
        self, notification_channel_subscription_id: int
    ):
        """
        Delete a channel subscription by id
        """
        query = delete(NotificationChannelSubscription).where(
            NotificationChannelSubscription.notification_channel_subscription_id
            == notification_channel_subscription_id
        )
        await self.db.execute(query)
        await self.db.flush()
