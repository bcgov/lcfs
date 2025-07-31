from lcfs.db.models.notification import (
    NotificationChannelSubscription,
    NotificationMessage,
    NotificationChannel,
    NotificationType,
    ChannelEnum,
)
from lcfs.db.models.organization import Organization
from lcfs.db.models.user import UserProfile
from lcfs.db.models.user.Role import Role, RoleEnum
from lcfs.db.models.user.UserRole import UserRole
from lcfs.web.api.base import (
    NotificationTypeEnum,
    PaginationRequestSchema,
    apply_filter_conditions,
    get_field_for_filter,
    validate_pagination,
)
import structlog

from typing import List, Optional, Sequence
from fastapi import Depends
from lcfs.db.dependencies import get_async_db_session
from lcfs.web.exception.exceptions import DataNotFoundException

from sqlalchemy import asc, delete, desc, or_, select, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload

from lcfs.web.core.decorators import repo_handler
from sqlalchemy import and_

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
    async def create_notification_messages(
        self, notification_messages: List[NotificationMessage]
    ) -> None:
        """
        Create bulk notification messages
        """
        self.db.add_all(notification_messages)
        await self.db.flush()

    @repo_handler
    async def get_notification_messages_by_user(
        self, user_profile_id: int, is_read: Optional[bool] = None
    ) -> list[NotificationMessage]:
        """
        Retrieve all notification messages for a user
        """
        # Start building the query
        query = (
            select(NotificationMessage)
            .options(
                joinedload(NotificationMessage.related_organization),
                joinedload(NotificationMessage.origin_user_profile)
                .joinedload(UserProfile.user_roles)
                .joinedload(UserRole.role),
            )
            .where(NotificationMessage.related_user_profile_id == user_profile_id)
        )

        # Apply additional filter for `is_read` if provided
        if is_read is not None:
            query = query.where(NotificationMessage.is_read == is_read)

        # Execute the query and retrieve the results
        result = await self.db.execute(query)
        return result.unique().scalars().all()

    def _apply_notification_filters(
        self, pagination: PaginationRequestSchema, conditions: List
    ):
        for filter in pagination.filters:
            filter_value = filter.filter
            filter_option = filter.type
            filter_type = filter.filter_type

            # Handle date filters
            if filter.field == "date":
                filter_value = filter.date_from
                field = get_field_for_filter(NotificationMessage, "create_date")
                conditions.append(
                    apply_filter_conditions(
                        field, filter_value, filter_option, filter_type
                    )
                )
            elif filter.field == "user":
                conditions.append(
                    NotificationMessage.origin_user_profile.has(
                        UserProfile.first_name.like(f"%{filter_value}%")
                    )
                )
            elif filter.field == "organization":
                conditions.append(
                    NotificationMessage.related_organization.has(
                        Organization.name.like(f"%{filter_value}%")
                    )
                )
            elif filter.field == "transaction_id":
                field = get_field_for_filter(
                    NotificationMessage, "related_transaction_id"
                )
                conditions.append(
                    apply_filter_conditions(
                        field, filter_value, filter_option, filter_type
                    )
                )
            else:
                field = get_field_for_filter(NotificationMessage, filter.field)
                conditions.append(
                    apply_filter_conditions(
                        field, filter_value, filter_option, filter_type
                    )
                )

        return conditions

    @repo_handler
    async def get_paginated_notification_messages(
        self, user_id, pagination: PaginationRequestSchema
    ) -> tuple[Sequence[NotificationMessage], int]:
        """
        Queries notification messages from the database with optional filters. Supports pagination and sorting.

        Args:
            pagination (dict): Pagination and sorting parameters.

        Returns:
            List[NotificationSchema]: A list of notification messages matching the query.
        """
        conditions = [NotificationMessage.related_user_profile_id == user_id]
        pagination = validate_pagination(pagination)

        if pagination.filters:
            self._apply_notification_filters(pagination, conditions)

        offset = 0 if (pagination.page < 1) else (pagination.page - 1) * pagination.size
        limit = pagination.size
        # Start building the query
        query = (
            select(NotificationMessage)
            .options(
                joinedload(NotificationMessage.related_organization),
                joinedload(NotificationMessage.origin_user_profile)
                .joinedload(UserProfile.user_roles)
                .joinedload(UserRole.role),
            )
            .where(and_(*conditions))
        )

        # Apply sorting
        order_clauses = []
        if not pagination.sort_orders:
            order_clauses.append(desc(NotificationMessage.create_date))
        else:
            for order in pagination.sort_orders:
                direction = asc if order.direction == "asc" else desc
                if order.field == "date":
                    field = NotificationMessage.create_date
                elif order.field == "user":
                    field = UserProfile.first_name
                elif order.field == "organization":
                    field = Organization.name
                elif order.field == "transaction_id":
                    field = NotificationMessage.related_transaction_id
                elif order.field == "action":
                    # Action column is not sortable, skip it
                    field = None
                elif order.field == "type":
                    field = NotificationMessage.type
                else:
                    # Only try to get attribute if it exists on the model
                    field = getattr(NotificationMessage, order.field, None)
                if field is not None:
                    order_clauses.append(direction(field))
        query = query.order_by(*order_clauses)

        # Execute the count query to get the total count
        count_query = query.with_only_columns(func.count()).order_by(None)
        total_count = (await self.db.execute(count_query)).scalar()

        # Execute the main query to retrieve all notification_messages
        result = await self.db.execute(query.offset(offset).limit(limit))
        notification_messages = result.unique().scalars().all()
        return notification_messages, total_count

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
        notification = result.scalar_one_or_none()

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
    async def delete_notification_messages(self, user_id, notification_ids: List[int]):
        """
        Delete a notification_message by id
        """
        stmt = (
            delete(NotificationMessage)
            .where(
                NotificationMessage.notification_message_id.in_(notification_ids),
                NotificationMessage.related_user_profile_id == user_id,
            )
            .returning(NotificationMessage.notification_message_id)
        )
        result = await self.db.execute(stmt)
        await self.db.flush()

        deleted_ids = result.scalars().all()
        return deleted_ids or []

    @repo_handler
    async def delete_all_notifications_for_user(self, user_id: int) -> list[int]:
        """
        Deletes ALL notifications for a user.
        Returns the IDs of the notifications that were deleted.
        """
        stmt = (
            delete(NotificationMessage)
            .where(NotificationMessage.related_user_profile_id == user_id)
            .returning(NotificationMessage.notification_message_id)
        )
        result = await self.db.execute(stmt)
        await self.db.flush()

        deleted_ids = result.scalars().all()
        return deleted_ids

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
    async def mark_notifications_as_read(
        self, user_id: int, notification_ids: List[int]
    ):
        """
        Mark notification messages as read for a user
        """
        if not notification_ids:
            return []

        stmt = (
            update(NotificationMessage)
            .where(
                and_(
                    NotificationMessage.notification_message_id.in_(notification_ids),
                    NotificationMessage.related_user_profile_id == user_id,
                )
            )
            .values(is_read=True)
        )
        await self.db.execute(stmt)
        await self.db.flush()

        return notification_ids

    @repo_handler
    async def mark_all_notifications_as_read_for_user(self, user_id: int) -> list[int]:
        """
        Marks ALL notifications as read for a user.
        Returns the IDs of the notifications that were updated.
        """
        stmt = (
            update(NotificationMessage)
            .where(NotificationMessage.related_user_profile_id == user_id)
            .values(is_read=True)
            .returning(NotificationMessage.notification_message_id)
        )
        result = await self.db.execute(stmt)
        await self.db.flush()

        updated_ids = result.scalars().all()
        return updated_ids

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
    ) -> List[NotificationChannelSubscription]:
        """
        Retrieve channel subscriptions for a user, including channel name and notification type name.
        """
        query = (
            select(NotificationChannelSubscription)
            .options(
                selectinload(NotificationChannelSubscription.notification_channel),
                selectinload(NotificationChannelSubscription.notification_type),
            )
            .where(NotificationChannelSubscription.user_profile_id == user_profile_id)
        )
        result = await self.db.execute(query)
        subscriptions = result.scalars().all()

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

    @repo_handler
    async def get_notification_type_by_name(self, name: str) -> Optional[int]:
        """
        Retrieve a NotificationType by its name
        """
        query = select(NotificationType.notification_type_id).where(
            NotificationType.name == name
        )
        result = await self.db.execute(query)
        x = result.scalars().first()
        return x

    @repo_handler
    async def get_notification_channel_by_name(
        self, name: ChannelEnum
    ) -> Optional[int]:
        """
        Retrieve a NotificationChannel by its name
        """
        query = select(NotificationChannel.notification_channel_id).where(
            NotificationChannel.channel_name == name.value
        )
        result = await self.db.execute(query)
        return result.scalars().first()

    @repo_handler
    async def get_subscribed_users_by_channel(
        self,
        notification_type: NotificationTypeEnum,
        channel: ChannelEnum,
        organization_id: int = None,
    ) -> List[int]:
        """
        Retrieve a list of user ids subscribed to a notification type
        """
        query = (
            select(NotificationChannelSubscription)
            .options(
                selectinload(NotificationChannelSubscription.user_profile)
                .selectinload(UserProfile.user_roles)
                .selectinload(UserRole.role)
            )
            .join(
                NotificationType,
                NotificationType.notification_type_id
                == NotificationChannelSubscription.notification_type_id,
            )
            .join(
                NotificationChannel,
                NotificationChannel.notification_channel_id
                == NotificationChannelSubscription.notification_channel_id,
            )
            .join(
                UserProfile,
                UserProfile.user_profile_id
                == NotificationChannelSubscription.user_profile_id,
            )
            .filter(
                NotificationType.name == notification_type.value,
                NotificationChannelSubscription.is_enabled == True,
                NotificationChannel.channel_name == channel.value,
                or_(
                    UserProfile.organization_id == organization_id,
                    UserProfile.organization_id.is_(None),
                ),
            )
        )
        result = await self.db.execute(query)
        return result.scalars().all()

    @repo_handler
    async def delete_subscriptions_for_user_role(
        self, user_profile_id: int, role: RoleEnum
    ) -> None:
        """
        Deletes all subscriptions for a user based on the role provided.
        """
        # Get the role id
        role_obj_stmt = select(Role).where(Role.name == role)
        role_obj_result = await self.db.execute(role_obj_stmt)
        role_obj = role_obj_result.scalar_one_or_none()

        if not role_obj:
            # If the RoleEnum has no matching row in the DB, skip or raise an error
            logger.warning(
                f"Role '{role.value}' not found in the DB. No subscriptions deleted."
            )
            return

        # Find all notification type ids matching that role id
        subquery = select(NotificationType.notification_type_id).where(
            NotificationType.role_id == role_obj.role_id
        )

        # Delete all subscriptions for those notification type ids
        stmt = (
            delete(NotificationChannelSubscription)
            .where(NotificationChannelSubscription.user_profile_id == user_profile_id)
            .where(NotificationChannelSubscription.notification_type_id.in_(subquery))
        )

        await self.db.execute(stmt)
        await self.db.flush()

    @repo_handler
    async def add_subscriptions_for_user_role(
        self, user_profile_id: int, role: RoleEnum
    ) -> None:
        """
        Adds subscriptions for a user based on the role provided.
        """
        # Get the role id
        role_obj_stmt = select(Role).where(Role.name == role)
        role_obj_result = await self.db.execute(role_obj_stmt)
        role_obj = role_obj_result.scalar_one_or_none()

        if not role_obj:
            logger.warning(
                f"Role '{role.value}' not found in the DB. Cannot add subscriptions."
            )
            return

        # Get all channels that are enabled & set to subscribe by default
        channels_stmt = select(NotificationChannel.notification_channel_id).where(
            NotificationChannel.enabled == True,
            NotificationChannel.subscribe_by_default == True,
        )
        channels_result = await self.db.execute(channels_stmt)
        channel_ids = channels_result.scalars().all()

        if not channel_ids:
            logger.info("No enabled notification channels found.")
            return

        # Get all notification types with that role_id
        notif_type_stmt = select(NotificationType).where(
            NotificationType.role_id == role_obj.role_id
        )
        types_result = await self.db.execute(notif_type_stmt)
        matching_types = types_result.scalars().all()

        if not matching_types:
            logger.info(f"No notification types found for role_id={role_obj.role_id}")
            return

        # For each matching notification_type & each channel, insert if missing
        for nt in matching_types:
            for ch_id in channel_ids:
                # Check if there's already a subscription for (user, type, channel)
                sub_exists_query = select(NotificationChannelSubscription).where(
                    NotificationChannelSubscription.user_profile_id == user_profile_id,
                    NotificationChannelSubscription.notification_type_id
                    == nt.notification_type_id,
                    NotificationChannelSubscription.notification_channel_id == ch_id,
                )
                existing_sub_result = await self.db.execute(sub_exists_query)
                existing_sub = existing_sub_result.scalar_one_or_none()

                if not existing_sub:
                    new_sub = NotificationChannelSubscription(
                        user_profile_id=user_profile_id,
                        notification_type_id=nt.notification_type_id,
                        notification_channel_id=ch_id,
                        is_enabled=True,
                    )
                    self.db.add(new_sub)

        await self.db.flush()

    @repo_handler
    async def delete_subscriptions_for_user(self, user_profile_id: int):
        """
        Delete all NotificationChannelSubscription rows referencing the user.
        """
        await self.db.execute(
            delete(NotificationChannelSubscription).where(
                NotificationChannelSubscription.user_profile_id == user_profile_id
            )
        )
        await self.db.flush()
