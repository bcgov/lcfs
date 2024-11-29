from typing import Optional
from lcfs.db.models.notification import (
    NotificationChannelSubscription,
    NotificationMessage,
)
from lcfs.web.api.notification.schema import (
    SubscriptionSchema,
    NotificationMessageSchema,
)
from lcfs.web.exception.exceptions import DataNotFoundException
import structlog
import math
from fastapi import Depends
from lcfs.web.api.notification.repo import NotificationRepository
from lcfs.web.core.decorators import service_handler

logger = structlog.get_logger(__name__)


class NotificationService:
    def __init__(
        self, repo: NotificationRepository = Depends(NotificationRepository)
    ) -> None:
        self.repo = repo

    @service_handler
    async def get_notification_messages_by_user_id(
        self, user_id: int, is_read: Optional[bool] = None
    ):
        """
        Retrieve all notifications for a given user.
        Optionally filter by read status.
        """
        notification_models = await self.repo.get_notification_messages_by_user(
            user_profile_id=user_id, is_read=is_read
        )

        return [
            NotificationMessageSchema.model_validate(message)
            for message in notification_models
        ]

    @service_handler
    async def get_notification_message_by_id(self, notification_id: int):
        """
        Retrieve a specific notification by ID.
        """
        notification = await self.repo.get_notification_message_by_id(notification_id)

        return NotificationMessageSchema.model_validate(notification)

    @service_handler
    async def count_unread_notifications_by_user_id(self, user_id: int):
        """
        Retrieve notification count by user id
        """
        return await self.repo.get_unread_notification_message_count_by_user_id(
            user_id=user_id
        )

    @service_handler
    async def mark_notification_as_read(self, notification_id: int):
        """
        Mark a specific notification as read.
        """
        notification = await self.repo.mark_notification_as_read(notification_id)
        if not notification:
            raise DataNotFoundException(
                f"Notification with ID {notification_id} not found."
            )
        return notification

    @service_handler
    async def create_notification_message(
        self, notification_data: NotificationMessageSchema
    ):
        """
        Create a new notification message.
        """
        notification = NotificationMessage(
            **notification_data.model_dump(exclude={"deleted"})
        )
        return await self.repo.create_notification_message(notification)

    @service_handler
    async def update_notification(self, notification_data: NotificationMessageSchema):
        """
        Update an existing notification.
        """
        notification = NotificationMessage(
            **notification_data.model_dump(exclude={"deleted"})
        )
        return await self.repo.update_notification_message(notification)

    @service_handler
    async def delete_notification_message(self, notification_id: int):
        """
        Delete a notification.
        """
        # Fetch the notification to confirm it exists
        notification = await self.repo.get_notification_message_by_id(notification_id)

        if notification:
            await self.repo.delete_notification_message(notification_id)
            logger.info(f"Notification with ID {notification_id} has been deleted.")
        else:
            raise DataNotFoundException(f"Notification with ID {notification_id}.")

    @service_handler
    async def get_notification_type_id_by_key(self, key: str) -> int:
        notification_type = await self.repo.get_notification_type_by_key(key)
        if not notification_type:
            raise ValueError(f"Invalid notification type key: {key}")
        return notification_type

    @service_handler
    async def get_notification_channel_id_by_key(self, key: str) -> int:
        notification_channel = await self.repo.get_notification_channel_by_key(key)
        if not notification_channel:
            raise ValueError(f"Invalid notification channel key: {key}")
        return notification_channel

    @service_handler
    async def create_notification_channel_subscription(
        self, subscription_data: SubscriptionSchema, user_profile_id: int
    ):
        notification_channel_id = await self.get_notification_channel_id_by_key(
            subscription_data.notification_channel_key
        )
        notification_type_id = await self.get_notification_type_id_by_key(
            subscription_data.notification_type_key
        )

        subscription = NotificationChannelSubscription(
            user_profile_id=user_profile_id,
            notification_channel_id=notification_channel_id,
            notification_type_id=notification_type_id,
            is_enabled=subscription_data.is_enabled,
        )
        created_subscription = await self.repo.create_notification_channel_subscription(
            subscription
        )
        x = 1
        return SubscriptionSchema.model_validate(created_subscription)

    @service_handler
    async def get_notification_channel_subscriptions_by_user_id(self, user_id: int):
        """
        Retrieve all notification channel subscriptions for a user.
        """
        subscriptions = await self.repo.get_notification_channel_subscriptions_by_user(
            user_id
        )

        subscriptions_with_keys = [
            {
                "notification_channel_subscription_id": subscription.notification_channel_subscription_id,
                "notification_channel_key": subscription.notification_channel.channel_name.name,
                "notification_type_key": subscription.notification_type.name,
            }
            for subscription in subscriptions
        ]

        return subscriptions_with_keys

    @service_handler
    async def get_notification_channel_subscription_by_id(
        self, notification_channel_subscription_id: int
    ):
        """
        Retrieve a specific notification channel subscription by ID.
        """
        return await self.repo.get_notification_channel_subscription_by_id(
            notification_channel_subscription_id
        )

    @service_handler
    async def update_notification_channel_subscription(
        self, subscription_data: SubscriptionSchema, user_profile_id: int
    ):
        notification_channel_subscription_id = (
            await self.get_notification_channel_id_by_key(
                subscription_data.notification_channel_subscription_id
            )
        )
        existing_subscription = (
            await self.repo.get_notification_channel_subscription_by_id(
                notification_channel_subscription_id
            )
        )
        if existing_subscription.user_profile_id != user_profile_id:
            raise DataNotFoundException(
                "You are not authorized to update this subscription."
            )

        subscription = NotificationChannelSubscription(
            **subscription_data.model_dump(exclude={"deleted"})
        )
        subscription.user_profile_id = user_profile_id  # Ensure correct user
        return await self.repo.update_notification_channel_subscription(subscription)

    @service_handler
    async def delete_notification_channel_subscription(
        self, subscription_id: int, user_profile_id: int
    ):
        subscription = await self.repo.get_notification_channel_subscription_by_id(
            subscription_id
        )
        if not subscription or subscription.user_profile_id != user_profile_id:
            raise DataNotFoundException(
                "Subscription not found or you are not authorized to delete it."
            )

        await self.repo.delete_notification_channel_subscription(subscription_id)
        logger.info(f"Deleted notification channel subscription {subscription_id}.")
