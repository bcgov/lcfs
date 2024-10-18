from typing import Optional

from lcfs.web.api.base import BaseSchema


class NotificationMessageRequest(BaseSchema):
    is_read: bool
    is_archived: bool


class NotificationChannelSubscriptionRequest(BaseSchema):
    is_enabled: bool
    channel_id: int
    notification_type_id: int
