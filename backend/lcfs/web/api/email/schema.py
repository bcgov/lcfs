from typing import Optional
from lcfs.web.api.base import NotificationTypeEnum
from pydantic import BaseModel, Field

class EmailNotificationRequest(BaseModel):
    notification_type: NotificationTypeEnum = Field(..., description="Type of notification")
    organization_id: Optional[int] = Field(None, description="Organization ID associated with the notification")

TEMPLATE_MAPPING = {
    "BCEID__COMPLIANCE_REPORT__DIRECTOR_ASSESSMENT": "bceid__compliance_report__director_assessment.html",
    "BCEID__INITIATIVE_AGREEMENT__DIRECTOR_APPROVAL": "bceid__initiative_agreement__director_approval.html",
    "BCEID__TRANSFER__DIRECTOR_DECISION": "bceid__transfer__director_decision.html",
    "BCEID__TRANSFER__PARTNER_ACTIONS": "bceid__transfer__partner_actions.html",
    "IDIR_ANALYST__COMPLIANCE_REPORT__DIRECTOR_DECISION": "idir_analyst__compliance_report__director_decision.html",
    "IDIR_ANALYST__COMPLIANCE_REPORT__MANAGER_RECOMMENDATION": "idir_analyst__compliance_report__manager_recommendation.html",
    "IDIR_ANALYST__COMPLIANCE_REPORT__SUBMITTED_FOR_REVIEW": "idir_analyst__compliance_report__submitted_for_review.html",
    "IDIR_ANALYST__INITIATIVE_AGREEMENT__RETURNED_TO_ANALYST": "idir_analyst__initiative_agreement__returned_to_analyst.html",
    "IDIR_ANALYST__TRANSFER__DIRECTOR_RECORDED": "idir_analyst__transfer__director_recorded.html",
    "IDIR_ANALYST__TRANSFER__RESCINDED_ACTION": "idir_analyst__transfer__rescinded_action.html",
    "IDIR_ANALYST__TRANSFER__SUBMITTED_FOR_REVIEW": "idir_analyst__transfer__submitted_for_review.html",
    "IDIR_COMPLIANCE_MANAGER__COMPLIANCE_REPORT__ANALYST_RECOMMENDATION": "idir_compliance_manager__compliance_report__analyst_recommendation.html",
    "IDIR_COMPLIANCE_MANAGER__COMPLIANCE_REPORT__DIRECTOR_ASSESSMENT": "idir_compliance_manager__compliance_report__director_assessment.html",
    "IDIR_COMPLIANCE_MANAGER__COMPLIANCE_REPORT__SUBMITTED_FOR_REVIEW": "idir_compliance_manager__compliance_report__submitted_for_review.html",
    "IDIR_DIRECTOR__COMPLIANCE_REPORT__MANAGER_RECOMMENDATION": "idir_director__compliance_report__manager_recommendation.html",
    "IDIR_DIRECTOR__INITIATIVE_AGREEMENT__ANALYST_RECOMMENDATION": "idir_director__initiative_agreement__analyst_recommendation.html",
    "IDIR_DIRECTOR__TRANSFER__ANALYST_RECOMMENDATION": "idir_director__transfer__analyst_recommendation.html",
    "IDIR_DIRECTOR__FUEL_CODE__ANALYST_RECOMMENDATION": "idir_director__fuel_code__analyst_recommendation.html",
    "IDIR_ANALYST__FUEL_CODE__DIRECTOR_RETURNED": "idir_analyst__fuel_code__director_returned.html",
    "IDIR_ANALYST__FUEL_CODE__DIRECTOR_APPROVAL": "idir_analyst__fuel_code__director_approval.html",
    "IDIR_ANALYST__FUEL_CODE__EXPIRY_NOTIFICATION": "idir_analyst__fuel_code__expiry_notification.html",
}
