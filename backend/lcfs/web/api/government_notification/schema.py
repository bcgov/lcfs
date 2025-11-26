from typing import Optional
from datetime import datetime
from enum import Enum
from pydantic import ConfigDict

from lcfs.web.api.base import BaseSchema


class NotificationTypeEnum(str, Enum):
    """Enum for notification types that map to MUI Alert color variants"""

    ALERT = "Alert"
    OUTAGE = "Outage"
    DEADLINE = "Deadline"
    GENERAL = "General"


class GovernmentNotificationSchema(BaseSchema):
    """Schema for government notification response"""

    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    government_notification_id: int
    notification_title: str
    notification_text: str
    link_url: Optional[str] = None
    notification_type: NotificationTypeEnum
    create_date: Optional[datetime] = None
    create_user: Optional[str] = None
    update_date: Optional[datetime] = None
    update_user: Optional[str] = None


class GovernmentNotificationUpdateSchema(BaseSchema):
    """Schema for updating government notification (compliance managers and directors)"""

    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    notification_title: str
    notification_text: str
    link_url: Optional[str] = None
    notification_type: NotificationTypeEnum
