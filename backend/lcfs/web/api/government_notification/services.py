from typing import Optional
from fastapi import Depends

from .repo import GovernmentNotificationRepository
from lcfs.web.api.government_notification.schema import (
    GovernmentNotificationSchema,
    GovernmentNotificationUpdateSchema,
)
from lcfs.db.models.notification.GovernmentNotification import NotificationTypeEnum
from lcfs.web.core.decorators import service_handler


class GovernmentNotificationService:
    def __init__(
        self, repo: GovernmentNotificationRepository = Depends(GovernmentNotificationRepository)
    ):
        self.repo = repo

    @service_handler
    async def get_current_notification(self) -> Optional[GovernmentNotificationSchema]:
        """
        Fetch the current government notification.
        Returns None if no notification exists.
        """
        notification = await self.repo.get_current_notification()
        if notification:
            return GovernmentNotificationSchema.model_validate(notification)
        return None

    @service_handler
    async def update_notification(
        self, notification_data: GovernmentNotificationUpdateSchema
    ) -> GovernmentNotificationSchema:
        """
        Update the government notification (or create if it doesn't exist).
        Only compliance managers can perform this action.
        """
        # Convert to dict and ensure enum is in the correct format
        data_dict = notification_data.model_dump()

        # Convert the notification_type string to the database enum object
        if "notification_type" in data_dict:
            notification_type_value = data_dict["notification_type"]
            # Convert string value to enum object by value
            data_dict["notification_type"] = NotificationTypeEnum(notification_type_value)

        notification = await self.repo.update_or_create_notification(data_dict)
        return GovernmentNotificationSchema.model_validate(notification)
