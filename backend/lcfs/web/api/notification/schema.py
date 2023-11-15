
from typing import Optional

from pydantic import BaseModel


class NotificationMessageRequest(BaseModel):
    is_read: bool
    is_archived: bool

class NotificationChannelSubscriptionRequest(BaseModel):
    is_enabled: bool
    channel_id: int
    notification_type_id: int