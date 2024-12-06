from typing import Optional

from lcfs.web.api.base import BaseSchema
from enum import Enum

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

class NotificationTypeEnum(str, Enum):
    DEFAULT = "DEFAULT"
    BCEID__CR__DIRECTOR_ASSESSMENT = "BCEID__CR__DIRECTOR_ASSESSMENT"
    BCEID__IA__DIRECTOR_APPROVAL = "BCEID__IA__DIRECTOR_APPROVAL"
    BCEID__TR__DIRECTOR_DECISION = "BCEID__TR__DIRECTOR_DECISION"
    BCEID__TR__PARTNER_ACTIONS = "BCEID__TR__PARTNER_ACTIONS"
    IDIR_A__CR__DIRECTOR_DECISION = "IDIR_A__CR__DIRECTOR_DECISION"
    IDIR_A__CR__MANAGER_RECOMMENDATION = "IDIR_A__CR__MANAGER_RECOMMENDATION"
    IDIR_A__CR__SUBMITTED_FOR_REVIEW = "IDIR_A__CR__SUBMITTED_FOR_REVIEW"
    IDIR_A__IA__RETURNED_TO_ANALYST = "IDIR_A__IA__RETURNED_TO_ANALYST"
    IDIR_A__TR__DIRECTOR_RECORDED = "IDIR_A__TR__DIRECTOR_RECORDED"
    IDIR_A__TR__RESCINDED_ACTION = "IDIR_A__TR__RESCINDED_ACTION"
    IDIR_A__TR__SUBMITTED_FOR_REVIEW = "IDIR_A__TR__SUBMITTED_FOR_REVIEW"
    IDIR_CM__CR__ANALYST_RECOMMENDATION = "IDIR_CM__CR__ANALYST_RECOMMENDATION"
    IDIR_CM__CR__DIRECTOR_ASSESSMENT = "IDIR_CM__CR__DIRECTOR_ASSESSMENT"
    IDIR_CM__CR__SUBMITTED_FOR_REVIEW = "IDIR_CM__CR__SUBMITTED_FOR_REVIEW"
    IDIR_D__CR__MANAGER_RECOMMENDATION = "IDIR_D__CR__MANAGER_RECOMMENDATION"
    IDIR_D__IA__ANALYST_RECOMMENDATION = "IDIR_D__IA__ANALYST_RECOMMENDATION"
    IDIR_D__TR__ANALYST_RECOMMENDATION = "IDIR_D__TR__ANALYST_RECOMMENDATION"