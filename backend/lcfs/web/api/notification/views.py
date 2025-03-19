"""
Notification endpoints
"""

from typing import Union, List
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.exception.exceptions import DataNotFoundException
import structlog
from fastapi import APIRouter, Body, Depends, HTTPException, Request, Response
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.notification.schema import (
    DeleteNotificationChannelSubscriptionResponseSchema,
    DeleteNotificationMessageResponseSchema,
    DeleteSubscriptionSchema,
    DeleteNotificationMessageSchema,
    NotificationsSchema,
    SubscriptionSchema,
    NotificationMessageSchema,
    NotificationCountSchema,
    NotificationBatchOperationSchema,
)
from lcfs.web.api.notification.services import NotificationService
from lcfs.web.core.decorators import view_handler
from starlette import status


router = APIRouter()
logger = structlog.get_logger(__name__)


@router.get(
    "/", response_model=List[NotificationMessageSchema], status_code=status.HTTP_200_OK
)
@view_handler([RoleEnum.GOVERNMENT])
async def get_notification_messages_by_user_id(
    request: Request,
    is_read: bool = None,
    service: NotificationService = Depends(),
):
    """
    Retrieve all notifications of a user
    """

    return await service.get_notification_messages_by_user_id(
        user_id=request.user.user_profile_id, is_read=is_read
    )


@router.post(
    "/list", response_model=NotificationsSchema, status_code=status.HTTP_200_OK
)
@view_handler(["*"])
async def get_notification_messages_by_user_id(
    request: Request,
    pagination: PaginationRequestSchema = Body(..., embed=False),
    response: Response = None,
    service: NotificationService = Depends(),
):
    """
    Retrieve all notifications of a user with pagination
    """
    return await service.get_paginated_notification_messages(
        user_id=request.user.user_profile_id, pagination=pagination
    )


@router.put("/", response_model=List[int], status_code=status.HTTP_200_OK)
@view_handler(["*"])
async def update_notification_messages_to_read(
    request: Request,
    payload: NotificationBatchOperationSchema = Body(...),
    service: NotificationService = Depends(),
):
    """
    Mark notifications as read.

    If payload.applyToAll is True, mark all notifications as read.
    Otherwise, mark just the given notification_ids.
    """
    return await service.update_notification_messages(
        request.user.user_profile_id,
        payload=payload.model_dump(),
    )


@router.delete("/", response_model=List[int], status_code=status.HTTP_200_OK)
@view_handler(["*"])
async def delete_notification_messages(
    request: Request,
    payload: NotificationBatchOperationSchema = Body(...),
    service: NotificationService = Depends(),
):
    """
    Delete notifications.

    If payload.applyToAll is True, delete all notifications.
    Otherwise, delete just the given notification_ids.
    """
    return await service.delete_notification_messages(
        request.user.user_profile_id,
        payload=payload.model_dump(),
    )


@router.get(
    "/count",
    response_model=NotificationCountSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(["*"])
async def get_unread_notifications(
    request: Request, service: NotificationService = Depends()
):
    """
    Retrieve counter for unread notifications by user id
    """
    # Count unread notifications
    count = await service.count_unread_notifications_by_user_id(
        user_id=request.user.user_profile_id
    )
    return NotificationCountSchema(count=count)


@router.get(
    "/subscriptions",
    response_model=List[SubscriptionSchema],
    status_code=status.HTTP_200_OK,
)
@view_handler(["*"])
async def get_notifications_channel_subscriptions_by_user_id(
    request: Request, service: NotificationService = Depends()
):
    return await service.get_notification_channel_subscriptions_by_user_id(
        user_id=request.user.user_profile_id
    )


@router.post(
    "/save",
    response_model=Union[
        NotificationMessageSchema, DeleteNotificationMessageResponseSchema
    ],
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.GOVERNMENT])
async def save_notification(
    request: Request,
    request_data: Union[
        NotificationMessageSchema, DeleteNotificationMessageSchema
    ] = Body(...),
    service: NotificationService = Depends(),
):
    """
    Save a single notification
    """
    notification_id = request_data.notification_message_id
    if request_data.deleted:
        try:
            await service.delete_notification_message(notification_id)
            return DeleteNotificationMessageResponseSchema(
                message="Notification Message deleted successfully"
            )
        except DataNotFoundException as e:
            raise HTTPException(status_code=404, detail=str(e))
    elif notification_id:
        return await service.update_notification(request_data)
    else:
        return await service.create_notification_message(request_data)


@router.post(
    "/subscriptions/save",
    response_model=Union[
        SubscriptionSchema, DeleteNotificationChannelSubscriptionResponseSchema
    ],
    status_code=status.HTTP_200_OK,
)
@view_handler(["*"])
async def save_subscription(
    request: Request,
    request_data: Union[SubscriptionSchema, DeleteSubscriptionSchema] = Body(...),
    service: NotificationService = Depends(),
):
    user_profile_id = request.user.user_profile_id
    subscription_id = request_data.notification_channel_subscription_id

    if request_data.deleted:
        try:
            await service.delete_notification_channel_subscription(
                subscription_id, user_profile_id
            )
            return DeleteNotificationChannelSubscriptionResponseSchema(
                message="Notification Subscription deleted successfully"
            )
        except DataNotFoundException as e:
            raise HTTPException(status_code=404, detail=str(e))
    else:
        return await service.create_notification_channel_subscription(
            request_data, user_profile_id
        )


@router.get(
    "/subscriptions/{notification_channel_subscription_id}",
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.GOVERNMENT])
async def get_notification_channel_subscription_by_id(
    request: Request,
    notification_channel_subscription_id: int,
    service: NotificationService = Depends(),
):

    subscription = await service.get_notification_channel_subscription_by_id(
        notification_channel_subscription_id=notification_channel_subscription_id
    )

    if subscription.user_profile_id != request.user.user_profile_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access this resource.",
        )

    return subscription


@router.get(
    "/{notification_id}",
    response_model=NotificationMessageSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.GOVERNMENT])
async def get_notification_message_by_id(
    request: Request, notification_id: int, service: NotificationService = Depends()
):
    """
    Retrieve a single notification by ID
    """

    notification = await service.get_notification_message_by_id(
        notification_id=notification_id
    )
    if notification.related_user_profile_id != request.user.user_profile_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access this resource.",
        )

    return notification
