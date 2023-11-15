from typing import Annotated
from fastapi import APIRouter, Depends
from lcfs.db.dependencies import SessionLocal
from lcfs.web.api.base import EntityResponse
from lcfs.web.api.notification.schema import NotificationChannelSubscriptionRequest, NotificationMessageRequest
from starlette import status
from sqlalchemy.ext.asyncio import AsyncSession
from lcfs.db.dependencies import get_async_db_session
from ....db.models import NotificationMessage, User

from sqlalchemy import select, update

router = APIRouter()


# all routes should have a User dependency

@router.get('/', status_code=status.HTTP_200_OK)
async def get_notifications(user, db: Annotated[AsyncSession, Depends(get_async_db_session)], response_model=EntityResponse) -> EntityResponse:
    # get all notifications of a user
    # check for user auth. raise otherwise
    # raise HTTPException()
    # return db.execute(select(NotificationMessage).where(NotificationMessage.id == user.id))
    return 

@router.get('/{notification_id}', status_code=status.HTTP_200_OK)
async def get_notification(user, notification_id: int, db: Annotated[AsyncSession, Depends(get_async_db_session)], response_model=EntityResponse) -> EntityResponse:
    # get a single notitification of a user
    # check for user auth. raise otherwise
    # raise HTTPException()
    # get notification by id
    # return db.execute(select(NotificationMessage).where(NotificationMessage.id == notification_id))
    return

@router.put('/{notification_id}', status_code=status.HTTP_204_NO_CONTENT)
async def update_notification(user, notification_id: int, db:Annotated[AsyncSession, Depends(get_async_db_session)], reqeust: NotificationMessageRequest,response_model=EntityResponse) -> EntityResponse:
    # update a notification of a user
    # check for user auth. raise otherwise
    # raise HTTPException()
    # return db.execute(update(NotificationMessage).where(NotificationMessage.id == notification_id).values())
    return

@router.get('/', status_code=status.HTTP_200_OK)
async def get_notifications_channel_subscriptions(user, db: Annotated[AsyncSession, Depends(get_async_db_session)], response_model=EntityResponse) -> EntityResponse:
    # get all notification subscriptions
    # check for user auth. raise otherwise
    # raise HTTPException()
    # return db.execute(select(NotificationChannelSubscription).where(NotificationChannelSubscription.user_id == user.id))
    return

@router.get('/{notification_channel_subscription_id}', status_code=status.HTTP_200_OK)
async def get_notification_channel_subscription(user, notification_channel_subscription_id: int, db:Annotated[AsyncSession, Depends(get_async_db_session)], response_model=EntityResponse) -> EntityResponse:
    # get a single notification subscriptions
    # check for user auth. raise otherwise
    # raise HTTPException()
    # get notification subscription by id
    # return db.execute(select(NotificationChannelSubscription).where(NotificationChannelSubscription.id == notification_channel_subscription_id))
    return

@router.put('/{notification_channel_subscription_id}', status_code=status.HTTP_204_NO_CONTENT)
async def update_notification_channel_subscription(user, notification_channel_subscription_id: int, db:Annotated[AsyncSession, Depends(get_async_db_session)], request: NotificationChannelSubscriptionRequest, response_model=EntityResponse ) -> EntityResponse:
    # update a notification subscription of a user
    # check for user auth. raise otherwise
    # raise HTTPException()
    # return db.execute(update(NotificationChannelSubscription).where(NotificationChannelSubscription.id == notification_channel_subscription_id).values())
    return

@router.delete('/{notification_channel_subscription_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification_channel_subscription(user, notification_channel_subscription_id: int, db:Annotated[AsyncSession, Depends(get_async_db_session)], response_model=EntityResponse ) -> EntityResponse:
    # delete a notification subscription of a user
    # check for user auth. raise otherwise
    # raise HTTPException()
    # return db.execute(delete(NotificationChannelSubscription).where(NotificationChannelSubscription.id == notification_channel_subscription_id))
    return