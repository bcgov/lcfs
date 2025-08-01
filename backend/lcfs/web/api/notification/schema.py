from datetime import datetime
from typing import Any, Dict, List, Optional

from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum
from lcfs.db.models.initiative_agreement.InitiativeAgreementStatus import (
    InitiativeAgreementStatusEnum,
)
from lcfs.db.models.transfer.TransferStatus import TransferStatusEnum
from lcfs.db.models.fuel.FuelCodeStatus import FuelCodeStatusEnum
from lcfs.web.api.base import BaseSchema, NotificationTypeEnum, PaginationResponseSchema
from pydantic import computed_field


class NotificationOrganizationSchema(BaseSchema):
    organization_id: int
    name: str


class NotificationUserProfileSchema(BaseSchema):
    first_name: str
    last_name: str
    organization_id: Optional[int] = None
    is_government: bool = False

    @computed_field
    @property
    def full_name(self) -> str:
        if self.is_government:
            return "Government of B.C."
        return f"{self.first_name} {self.last_name}"


class NotificationMessageSchema(BaseSchema):
    notification_message_id: Optional[int] = None
    is_read: Optional[bool] = False
    is_archived: Optional[bool] = False
    is_warning: Optional[bool] = False
    is_error: Optional[bool] = False
    type: Optional[str] = None
    message: Optional[str] = None
    related_organization_id: Optional[int] = None
    related_organization: Optional[NotificationOrganizationSchema] = None
    related_transaction_id: Optional[str] = None
    create_date: Optional[datetime] = None
    origin_user_profile_id: Optional[int] = None
    origin_user_profile: Optional[NotificationUserProfileSchema] = None
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


class NotificationsSchema(BaseSchema):
    notifications: List[NotificationMessageSchema] = []
    pagination: PaginationResponseSchema = None


class NotificationRequestSchema(BaseSchema):
    notification_types: List[NotificationTypeEnum]
    notification_context: Optional[Dict[str, Any]] = {}
    notification_data: Optional[NotificationMessageSchema] = None


class NotificationBatchOperationSchema(BaseSchema):
    applyToAll: bool = False
    notification_ids: Optional[List[int]] = []


COMPLIANCE_REPORT_STATUS_NOTIFICATION_MAPPER = {
    ComplianceReportStatusEnum.Submitted: [
        NotificationTypeEnum.IDIR_ANALYST__COMPLIANCE_REPORT__SUBMITTED_FOR_REVIEW,
        NotificationTypeEnum.IDIR_COMPLIANCE_MANAGER__COMPLIANCE_REPORT__SUBMITTED_FOR_REVIEW,
    ],
    ComplianceReportStatusEnum.Recommended_by_analyst: [
        NotificationTypeEnum.IDIR_COMPLIANCE_MANAGER__COMPLIANCE_REPORT__ANALYST_RECOMMENDATION
    ],
    ComplianceReportStatusEnum.Recommended_by_manager: [
        NotificationTypeEnum.IDIR_DIRECTOR__COMPLIANCE_REPORT__MANAGER_RECOMMENDATION
    ],
    ComplianceReportStatusEnum.Assessed: [
        NotificationTypeEnum.IDIR_ANALYST__COMPLIANCE_REPORT__DIRECTOR_DECISION,
        NotificationTypeEnum.IDIR_COMPLIANCE_MANAGER__COMPLIANCE_REPORT__DIRECTOR_ASSESSMENT,
        NotificationTypeEnum.BCEID__COMPLIANCE_REPORT__DIRECTOR_ASSESSMENT,
    ],
    "Return to analyst": [
        NotificationTypeEnum.IDIR_ANALYST__COMPLIANCE_REPORT__SUBMITTED_FOR_REVIEW
    ],
    "Return to manager": [
        NotificationTypeEnum.IDIR_COMPLIANCE_MANAGER__COMPLIANCE_REPORT__ANALYST_RECOMMENDATION
    ],
    "Return to supplier": [
        NotificationTypeEnum.BCEID__COMPLIANCE_REPORT__DIRECTOR_ASSESSMENT
    ],
}


TRANSFER_STATUS_NOTIFICATION_MAPPER = {
    TransferStatusEnum.Sent: [
        NotificationTypeEnum.BCEID__TRANSFER__PARTNER_ACTIONS,
    ],
    TransferStatusEnum.Rescinded: [
        NotificationTypeEnum.BCEID__TRANSFER__PARTNER_ACTIONS,
    ],
    TransferStatusEnum.Declined: [
        NotificationTypeEnum.BCEID__TRANSFER__PARTNER_ACTIONS,
    ],
    TransferStatusEnum.Submitted: [
        NotificationTypeEnum.BCEID__TRANSFER__PARTNER_ACTIONS,
        NotificationTypeEnum.IDIR_ANALYST__TRANSFER__SUBMITTED_FOR_REVIEW,
    ],
    TransferStatusEnum.Recommended: [
        NotificationTypeEnum.IDIR_DIRECTOR__TRANSFER__ANALYST_RECOMMENDATION
    ],
    TransferStatusEnum.Refused: [
        NotificationTypeEnum.IDIR_ANALYST__TRANSFER__RESCINDED_ACTION,
        NotificationTypeEnum.BCEID__TRANSFER__DIRECTOR_DECISION,
    ],
    TransferStatusEnum.Recorded: [
        NotificationTypeEnum.BCEID__TRANSFER__DIRECTOR_DECISION,
        NotificationTypeEnum.IDIR_ANALYST__TRANSFER__DIRECTOR_RECORDED,
    ],
    "Return to analyst": [
        NotificationTypeEnum.IDIR_ANALYST__TRANSFER__SUBMITTED_FOR_REVIEW
    ],
}

INITIATIVE_AGREEMENT_STATUS_NOTIFICATION_MAPPER = {
    InitiativeAgreementStatusEnum.Recommended: [
        NotificationTypeEnum.IDIR_DIRECTOR__INITIATIVE_AGREEMENT__ANALYST_RECOMMENDATION
    ],
    InitiativeAgreementStatusEnum.Approved: [
        NotificationTypeEnum.BCEID__INITIATIVE_AGREEMENT__DIRECTOR_APPROVAL,
        NotificationTypeEnum.IDIR_ANALYST__INITIATIVE_AGREEMENT__RETURNED_TO_ANALYST,
    ],
    "Return to analyst": [
        NotificationTypeEnum.IDIR_ANALYST__INITIATIVE_AGREEMENT__RETURNED_TO_ANALYST
    ],
}

FUEL_CODE_STATUS_NOTIFICATION_MAPPER = {
    FuelCodeStatusEnum.Recommended: [
        NotificationTypeEnum.IDIR_DIRECTOR__FUEL_CODE__ANALYST_RECOMMENDATION
    ],
    FuelCodeStatusEnum.Approved: [
        NotificationTypeEnum.IDIR_ANALYST__FUEL_CODE__DIRECTOR_APPROVAL
    ],
}
