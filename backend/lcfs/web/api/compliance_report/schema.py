from typing import Optional, List, Union
from datetime import datetime
from pydantic import EmailStr

from lcfs.web.api.base import BaseSchema
from lcfs.web.api.base import PaginationResponseSchema

"""
Base - all shared attributes of a resource
Create - attributes required to create a new resource - used at POST requests
Update - attributes that can be updated - used at PUT requests
InDB - attributes present on any resource coming out of the database
Public - attributes present on public facing resources being returned from GET, POST, and PUT requests
"""


class CompliancePeriodSchema(BaseSchema):
    compliance_period_id: int
    description: str
    effective_date: Optional[datetime] = None
    expiration_date: Optional[datetime] = None
    display_order: Optional[int] = None

class ComplianceReportOrganizationSchema(BaseSchema):
    organization_id: int
    name: str

class SummarySchema(BaseSchema):
    pass


class ComplianceReportStatusSchema(BaseSchema):
    compliance_report_status_id: int
    status: str


class SnapshotSchema(BaseSchema):
    pass


class ComplianceReportHistorySchema(BaseSchema):
    pass


class NotionalTransfersSchema(BaseSchema):
    pass


class FuelSuppliesSchema(BaseSchema):
    pass


class AllocationAgreementSchema(BaseSchema):
    pass


class OtherUsesSchema(BaseSchema):
    pass


class ComplianceReportBaseSchema(BaseSchema):
    compliance_report_id: int
    compliance_period_id: int
    compliance_period: CompliancePeriodSchema
    organization_id: int
    organization: ComplianceReportOrganizationSchema
    summary_id: Optional[int] = None
    summary: Optional[SummarySchema]
    status_id: int
    status: ComplianceReportStatusSchema
    transaction_id: Optional[int] = None
    # transaction: Optional[TransactionBaseSchema] = None
    nickname: Optional[str] = None
    supplemental_note: Optional[str] = None
    update_date: Optional[datetime] = None


class ComplianceReportCreateSchema(BaseSchema):
    compliance_period: str
    organization_id: int
    status: str


class ComplianceReportListSchema(BaseSchema):
    pagination: PaginationResponseSchema
    reports: List[ComplianceReportBaseSchema]