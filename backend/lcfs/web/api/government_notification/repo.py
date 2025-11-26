from typing import Optional
from fastapi import Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.notification.GovernmentNotification import GovernmentNotification
from lcfs.web.core.decorators import repo_handler


class GovernmentNotificationRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_current_notification(self) -> Optional[GovernmentNotification]:
        """
        Retrieves the current government notification.
        Since this is a single-record table, we just get the first record.
        """
        query = select(GovernmentNotification).limit(1)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    @repo_handler
    async def update_or_create_notification(
        self, notification_data: dict
    ) -> GovernmentNotification:
        """
        Updates the existing notification or creates a new one if it doesn't exist.
        This ensures we always have only one notification record.
        """
        # Check if a notification exists
        existing_notification = await self.get_current_notification()

        if existing_notification:
            # Update existing notification
            for key, value in notification_data.items():
                setattr(existing_notification, key, value)
            notification = existing_notification
        else:
            # Create new notification
            notification = GovernmentNotification(**notification_data)
            self.db.add(notification)

        await self.db.flush()
        await self.db.refresh(notification)
        return notification
