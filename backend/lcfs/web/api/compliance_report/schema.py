from enum import Enum
from typing import ClassVar, Optional, List, Union
from datetime import datetime, date
from enum import Enum
from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum
from lcfs.web.api.common.schema import CompliancePeriodBaseSchema
from lcfs.web.api.compliance_report.constants import FORMATS
from lcfs.web.api.fuel_code.schema import EndUseTypeSchema, EndUserTypeSchema

from lcfs.web.api.base import BaseSchema, FilterModel, SortOrder
from lcfs.web.api.base import PaginationResponseSchema
from pydantic import Field

"""
Base - all shared attributes of a resource
Create - attributes required to create a new resource - used at POST requests
Update - attributes that can be updated - used at PUT requests
InDB - attributes present on any resource coming out of the database
Public - attributes present on public facing resources being returned from GET, POST, and PUT requests
"""


class ReturnStatus(Enum):
    ANALYST = "Return to analyst"
    MANAGER = "Return to manager"
    SUPPLIER = "Return to supplier"


RETURN_STATUS_MAPPER = {
    ReturnStatus.ANALYST.value: ComplianceReportStatusEnum.Submitted.value,
    ReturnStatus.MANAGER.value: ComplianceReportStatusEnum.Recommended_by_analyst.value,
    ReturnStatus.SUPPLIER.value: ComplianceReportStatusEnum.Draft.value,
}


class SupplementalInitiatorType(str, Enum):
    SUPPLIER_SUPPLEMENTAL = "Supplier Supplemental"
    GOVERNMENT_REASSESSMENT = "Government Reassessment"


class ReportingFrequency(str, Enum):
    ANNUAL = "Annual"
    QUARTERLY = "Quarterly"


class PortsEnum(str, Enum):
    SINGLE = "Single port"
    DUAL = "Dual port"


class SummarySchema(BaseSchema):
    summary_id: int
    is_locked: bool

    class Config:
        extra = "allow"


class ComplianceReportStatusSchema(BaseSchema):
    compliance_report_status_id: int
    status: str


class SnapshotSchema(BaseSchema):
    pass


class ComplianceReportOrganizationSchema(BaseSchema):
    organization_id: int
    name: str


class ComplianceReportUserSchema(BaseSchema):
    first_name: str
    last_name: str
    organization: Optional[ComplianceReportOrganizationSchema] = None


class ComplianceReportHistorySchema(BaseSchema):
    compliance_report_history_id: int
    compliance_report_id: int
    status: ComplianceReportStatusSchema
    user_profile: ComplianceReportUserSchema
    display_name: Optional[str] = None
    create_date: datetime


class NotionalTransfersSchema(BaseSchema):
    pass


class FuelSuppliesSchema(BaseSchema):
    pass


class AllocationAgreementSchema(BaseSchema):
    pass


class LevelOfEquipmentSchema(BaseSchema):
    level_of_equipment_id: int
    name: str
    description: Optional[str] = None
    display_order: int


class FSEOptionsSchema(BaseSchema):
    intended_use_types: List[EndUseTypeSchema]
    intended_user_types: List[EndUserTypeSchema]
    levels_of_equipment: List[LevelOfEquipmentSchema]
    ports: ClassVar[List[str]] = [port.value for port in PortsEnum]


class ComplianceReportBaseSchema(BaseSchema):
    compliance_report_id: int
    compliance_report_group_uuid: Optional[str]
    version: Optional[int]
    supplemental_initiator: Optional[SupplementalInitiatorType]
    compliance_period_id: int
    compliance_period: CompliancePeriodBaseSchema
    organization_id: int
    organization: ComplianceReportOrganizationSchema
    summary: Optional[SummarySchema]
    current_status_id: int
    current_status: ComplianceReportStatusSchema
    transaction_id: Optional[int] = None
    nickname: Optional[str] = None
    supplemental_note: Optional[str] = None
    reporting_frequency: Optional[ReportingFrequency] = None
    update_date: Optional[datetime] = None
    history: Optional[List[ComplianceReportHistorySchema]] = None
    has_supplemental: bool
    legacy_id: Optional[int] = None


class ComplianceReportViewSchema(BaseSchema):
    compliance_report_id: int
    compliance_report_group_uuid: str
    version: int
    compliance_period_id: int
    compliance_period: str
    organization_id: int
    organization_name: str
    report_type: str
    report_status_id: int
    report_status: str
    update_date: datetime


class ChainedComplianceReportSchema(BaseSchema):
    report: ComplianceReportBaseSchema
    chain: Optional[List[ComplianceReportBaseSchema]] = []


class ComplianceReportCreateSchema(BaseSchema):
    compliance_period: str
    organization_id: int
    status: str
    legacy_id: Optional[int] = None
    nickname: Optional[str] = None


class ComplianceReportListSchema(BaseSchema):
    pagination: PaginationResponseSchema
    reports: List[ComplianceReportViewSchema]


class ComplianceReportSummaryRowSchema(BaseSchema):
    line: Optional[Union[int, str]] = None
    description: Optional[str] = ""
    field: Optional[str] = ""
    gasoline: Optional[float] = 0
    diesel: Optional[float] = 0
    jet_fuel: Optional[float] = 0
    value: Optional[float] = 0
    units: Optional[str] = ""
    bold: Optional[bool] = False
    total_value: Optional[float] = 0
    format: Optional[str] = FORMATS.NUMBER.value


class ComplianceReportSummarySchema(BaseSchema):
    renewable_fuel_target_summary: List[ComplianceReportSummaryRowSchema]
    low_carbon_fuel_target_summary: List[ComplianceReportSummaryRowSchema]
    non_compliance_penalty_summary: List[ComplianceReportSummaryRowSchema]
    can_sign: bool = False
    summary_id: Optional[int] = None
    compliance_report_id: Optional[int] = None
    version: Optional[int] = None
    is_locked: Optional[bool] = False
    quarter: Optional[int] = None


class ComplianceReportSummaryUpdateSchema(BaseSchema):
    compliance_report_id: int
    is_locked: Optional[bool] = False
    renewable_fuel_target_summary: List[ComplianceReportSummaryRowSchema]
    low_carbon_fuel_target_summary: List[ComplianceReportSummaryRowSchema]
    non_compliance_penalty_summary: List[ComplianceReportSummaryRowSchema]
    summary_id: int
    is_locked: bool


class CommonPaginatedReportRequestSchema(BaseSchema):
    compliance_report_id: int = Field(..., alias="complianceReportId")
    filters: Optional[List[FilterModel]] = None
    page: Optional[int] = None
    size: Optional[int] = None
    sort_orders: Optional[List[SortOrder]] = None


class ComplianceReportUpdateSchema(BaseSchema):
    status: str
    supplemental_note: Optional[str] = None
