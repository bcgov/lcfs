from typing import Optional
import structlog
from fastapi import Depends

from .repo import GovernmentNotificationRepository
from lcfs.web.api.government_notification.schema import (
    GovernmentNotificationSchema,
    GovernmentNotificationUpdateSchema,
)
from lcfs.db.models.notification.GovernmentNotification import NotificationTypeEnum
from lcfs.web.api.email.services import CHESEmailService
from lcfs.web.api.base import NotificationTypeEnum as BaseNotificationTypeEnum
from lcfs.web.core.decorators import service_handler

logger = structlog.get_logger(__name__)


class GovernmentNotificationService:
    def __init__(
        self,
        repo: GovernmentNotificationRepository = Depends(
            GovernmentNotificationRepository
        ),
        email_service: CHESEmailService = Depends(CHESEmailService),
    ):
        self.repo = repo
        self.email_service = email_service

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

        The notification is displayed on the dashboard for all users.
        Optionally sends email notifications if send_email=True.
        """
        # Extract the send_email flag before converting to dict
        send_email = notification_data.send_email

        # Convert to dict and ensure enum is in the correct format
        data_dict = notification_data.model_dump(exclude={"send_email"})

        # Convert the notification_type string to the database enum object
        if "notification_type" in data_dict:
            notification_type_value = data_dict["notification_type"]
            data_dict["notification_type"] = NotificationTypeEnum(
                notification_type_value
            )

        notification = await self.repo.update_or_create_notification(data_dict)
        result = GovernmentNotificationSchema.model_validate(notification)

        # Send email notifications only if requested
        if send_email:
            await self._send_email_notifications(result)

        return result

    async def _send_email_notifications(
        self, notification: GovernmentNotificationSchema
    ) -> None:
        """
        Send email notifications to all users subscribed to government notifications.
        Sends to both BCeID and IDIR users who have subscribed.
        """
        notification_context = {
            "notification_title": notification.notification_title,
            "notification_text": notification.notification_text,
            "notification_type": notification.notification_type,
            "link_url": notification.link_url,
        }

        notification_types = [
            BaseNotificationTypeEnum.BCEID__GOVERNMENT_NOTIFICATION,
            BaseNotificationTypeEnum.IDIR_ANALYST__GOVERNMENT_NOTIFICATION,
            BaseNotificationTypeEnum.IDIR_COMPLIANCE_MANAGER__GOVERNMENT_NOTIFICATION,
            BaseNotificationTypeEnum.IDIR_DIRECTOR__GOVERNMENT_NOTIFICATION,
        ]

        for notification_type in notification_types:
            try:
                await self.email_service.send_notification_email(
                    notification_type=notification_type,
                    notification_context=notification_context,
                    organization_id=None,
                    audience_type=None,
                )
                logger.info(
                    f"Government notification email sent for {notification_type.value}"
                )
            except Exception as e:
                logger.error(f"Failed to send email for {notification_type.value}: {e}")

    @service_handler
    async def delete_notification(self) -> bool:
        """
        Delete the current government notification.
        Only compliance managers and directors can perform this action.
        Returns True if deleted, False if no notification existed.
        """
        return await self.repo.delete_notification()
