from typing import Optional

from lcfs.web.api.base import BaseSchema


class NotificationMessageSchema(BaseSchema):
    notification_message_id: Optional[int] = None
    is_read: Optional[bool] = False
    is_archived: Optional[bool] = False
    is_warning: Optional[bool] = False
    is_error: Optional[bool] = False
    message: Optional[str] = None
    related_organization_id: Optional[int] = None
    origin_user_profile_id: Optional[int] = None
    related_user_profile_id: Optional[int] = None
    notification_type_id: Optional[int] = None
    deleted: Optional[bool] = None


class NotificationCountSchema(BaseSchema):
    count: int


class DeleteNotificationMessageSchema(BaseSchema):
    notification_message_id: int
    deleted: bool


class DeleteNotificationMessageResponseSchema(BaseSchema):
    message: str


class SubscriptionSchema(BaseSchema):
    notification_channel_subscription_id: Optional[int] = None
    is_enabled: Optional[bool] = True
    notification_channel_name: Optional[str] = None
    user_profile_id: Optional[int] = None
    notification_type_name: Optional[str] = None
    deleted: Optional[bool] = None


class DeleteSubscriptionSchema(BaseSchema):
    notification_channel_subscription_id: int
    deleted: bool


class DeleteNotificationChannelSubscriptionResponseSchema(BaseSchema):
    message: str
