import math
from typing import List, Optional
from lcfs.db.models.notification import (
    NotificationChannelSubscription,
    NotificationMessage,
    ChannelEnum,
)
from lcfs.web.api.base import (
    PaginationRequestSchema,
    PaginationResponseSchema,
)
from lcfs.web.api.email.services import CHESEmailService
from lcfs.web.api.notification.schema import (
    NotificationRequestSchema,
    NotificationsSchema,
    SubscriptionSchema,
    NotificationMessageSchema,
)
from lcfs.web.exception.exceptions import DataNotFoundException
import structlog
from fastapi import Depends
from lcfs.web.api.notification.repo import NotificationRepository
from lcfs.web.core.decorators import service_handler

logger = structlog.get_logger(__name__)


class NotificationService:

    def __init__(
        self,
        repo: NotificationRepository = Depends(NotificationRepository),
        email_service: CHESEmailService = Depends(CHESEmailService),
    ) -> None:
        self.repo = repo
        self.email_service = email_service

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
    async def get_paginated_notification_messages(
        self, user_id: int, pagination: PaginationRequestSchema
    ) -> NotificationsSchema:
        """
        Retrieve all notifications for a given user with pagination, filtering and sorting.
        """
        notifications, total_count = (
            await self.repo.get_paginated_notification_messages(user_id, pagination)
        )
        return NotificationsSchema(
            pagination=PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=math.ceil(total_count / pagination.size),
            ),
            notifications=[
                NotificationMessageSchema.model_validate(notification)
                for notification in notifications
            ],
        )

    @service_handler
    async def update_notification_messages(
        self, user_id: int, notification_ids: List[int]
    ):
        """
        Update multiple notifications (mark as read).
        """
        await self.repo.mark_notifications_as_read(user_id, notification_ids)

        return notification_ids

    @service_handler
    async def delete_notification_messages(
        self, user_id: int, notification_ids: List[int]
    ):
        """
        Delete multiple notifications.
        """
        await self.repo.delete_notification_messages(user_id, notification_ids)

        return notification_ids

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
    async def get_notification_type_id_by_name(self, name: str) -> int:
        notification_type = await self.repo.get_notification_type_by_name(name)
        if not notification_type:
            raise ValueError(f"Invalid notification type name: {name}")
        return notification_type

    @service_handler
    async def get_notification_channel_id_by_name(self, name: ChannelEnum) -> int:
        notification_channel = await self.repo.get_notification_channel_by_name(name)
        if not notification_channel:
            raise ValueError(f"Invalid notification channel name: {name}")
        return notification_channel

    @service_handler
    async def create_notification_channel_subscription(
        self, subscription_data: SubscriptionSchema, user_profile_id: int
    ):
        channel_enum_name = ChannelEnum(subscription_data.notification_channel_name)
        notification_channel_id = await self.get_notification_channel_id_by_name(
            channel_enum_name
        )
        notification_type_id = await self.get_notification_type_id_by_name(
            subscription_data.notification_type_name
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

        subscriptions_with_names = [
            {
                "notification_channel_subscription_id": subscription.notification_channel_subscription_id,
                "notification_channel_name": subscription.notification_channel.channel_name.name,
                "notification_type_name": subscription.notification_type.name,
            }
            for subscription in subscriptions
        ]

        return subscriptions_with_names

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

    @service_handler
    async def send_notification(self, notification: NotificationRequestSchema):
        """
        Send subscribed notifications to users.
        """
        # Prepare context once, outside the loop
        notification.notification_context.update(
            {"organization_id": notification.notification_data.related_organization_id}
        )

        for notification_type in notification.notification_types:
            in_app_subscribed_users = await self.repo.get_subscribed_users_by_channel(
                notification_type,
                ChannelEnum.IN_APP,
                notification.notification_data.related_organization_id,
            )

            # Batch create in-app notifications
            in_app_notifications = [
                NotificationMessage(
                    **notification.notification_data.model_dump(
                        exclude_unset=True, exclude={"deleted"}
                    ),
                    notification_type_id=subscription.notification_type_id,
                    related_user_profile_id=subscription.user_profile_id,
                )
                for subscription in in_app_subscribed_users
            ]
            if in_app_notifications:
                await self.repo.create_notification_messages(in_app_notifications)

            await self.email_service.send_notification_email(
                notification_type,
                notification.notification_context,
                notification.notification_data.related_organization_id,
            )

    @service_handler
    async def delete_subscriptions_for_user_role(
        self, user_profile_id: int, role_id: int
    ):
        """
        Deletes all notification subscriptions for a user with a given role.
        """
        await self.repo.delete_subscriptions_for_user_role(user_profile_id, role_id)

    @service_handler
    async def add_subscriptions_for_user_role(self, user_profile_id: int, role_id: int):
        """
        Adds subscriptions for a user based on their role.
        """
        await self.repo.add_subscriptions_for_user_role(user_profile_id, role_id)
