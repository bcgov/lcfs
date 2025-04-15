from enum import Enum
from typing import ClassVar, Optional, List, Union
from datetime import datetime
from typing import List, NamedTuple

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

class Quarter(str, Enum):
    Q1 = "Q1"
    Q2 = "Q2"
    Q3 = "Q3"
    Q4 = "Q4"

class PortsEnum(str, Enum):
    SINGLE = "Single port"
    DUAL = "Dual port"


class SummarySchema(BaseSchema):
    summary_id: int
    is_locked: bool
    line_11_fossil_derived_base_fuel_total: float
    line_21_non_compliance_penalty_payable: float

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
    quarter: Optional[Quarter] = None
    update_date: Optional[datetime] = None
    history: Optional[List[ComplianceReportHistorySchema]] = None
    has_supplemental: bool
    legacy_id: Optional[int] = None
    assessment_statement: Optional[str] = None


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
    is_newest: bool


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
    assessment_statement: Optional[str] = None


class ExportColumn(NamedTuple):
    label: str
    key: str = None


# Summary section constants
RENEWABLE_REQUIREMENT_TITLE = "Renewable fuel target summary"
LOW_CARBON_SUMMARY_TITLE = "Low carbon fuel target summary"
PENALTY_SUMMARY_TITLE = "Non-compliance penalty payable summary"

# Table style constants
TABLE_STYLE = "TableStyleLight15"
SHOW_ROW_STRIPES = False
SHOW_COL_STRIPES = False

# Sheet names
SUMMARY_SHEET = "Summary"
FUEL_SUPPLY_SHEET = "Fuel supply"
NOTIONAL_TRANSFER_SHEET = "Notional transfer"
OTHER_USES_SHEET = "Other uses"
EXPORT_FUEL_SHEET = "Export fuel"
ALLOCATION_AGREEMENTS_SHEET = "Allocation agreements"
FSE_EXPORT_SHEET = "Final supply equipment"

# Column definitions for each sheet
FUEL_SUPPLY_COLUMNS = [
    ExportColumn("Compliance Units"),
    ExportColumn("Fuel type"),
    ExportColumn("Fuel type Other"),
    ExportColumn("Fuel category"),
    ExportColumn("End use"),
    ExportColumn("Determining carbon intensity"),
    ExportColumn("Fuel code"),
    ExportColumn("Quantity supplied"),
    ExportColumn("Units"),
    ExportColumn("Target CI"),
    ExportColumn("RCI"),
    ExportColumn("UCI"),
    ExportColumn("Energy density"),
    ExportColumn("EER"),
    ExportColumn("Energy content"),
]

NOTIONAL_TRANSFER_COLUMNS = [
    ExportColumn("Legal name of trading partner"),
    ExportColumn("Address for service"),
    ExportColumn("Fuel category"),
    ExportColumn("Received OR Transferred"),
    ExportColumn("Quantity"),
]

OTHER_USES_COLUMNS = [
    ExportColumn("Fuel type"),
    ExportColumn("Fuel category"),
    ExportColumn("Determining carbon intensity"),
    ExportColumn("Fuel code"),
    ExportColumn("Quantity supplied"),
    ExportColumn("Units"),
    ExportColumn("RCI"),
    ExportColumn("Expected use"),
    ExportColumn("If other, enter expected use"),
]

EXPORT_FUEL_COLUMNS = [
    ExportColumn("Compliance units"),
    ExportColumn("Export date"),
    ExportColumn("Fuel type"),
    ExportColumn("Fuel type other"),
    ExportColumn("Fuel category"),
    ExportColumn("End use"),
    ExportColumn("Determining carbon intensity"),
    ExportColumn("Fuel code"),
    ExportColumn("Quantity supplied"),
    ExportColumn("Units"),
    ExportColumn("Target CI"),
    ExportColumn("RCI"),
    ExportColumn("UCI"),
    ExportColumn("Energy density"),
    ExportColumn("EER"),
    ExportColumn("Energy content"),
]

ALLOCATION_AGREEMENT_COLUMNS = [
    ExportColumn("Responsibility"),
    ExportColumn("Legal name of transaction partner"),
    ExportColumn("Address for service"),
    ExportColumn("Email"),
    ExportColumn("Phone"),
    ExportColumn("Fuel type"),
    ExportColumn("Fuel type other"),
    ExportColumn("Fuel category"),
    ExportColumn("Determining carbon intensity"),
    ExportColumn("Fuel code"),
    ExportColumn("RCI"),
    ExportColumn("Quantity"),
    ExportColumn("Units"),
]

FSE_EXPORT_COLUMNS = [
    ExportColumn("Organization name"),
    ExportColumn("Supply from Date"),
    ExportColumn("Supply to Date"),
    ExportColumn("kWh Usage"),
    ExportColumn("Serial #"),
    ExportColumn("Manufacturer"),
    ExportColumn("Model"),
    ExportColumn("Level of equipment"),
    ExportColumn("Ports"),
    ExportColumn("Intended use types"),
    ExportColumn("Intended user types"),
    ExportColumn("Street address"),
    ExportColumn("City"),
    ExportColumn("Postal code"),
    ExportColumn("Latitude"),
    ExportColumn("Longitude"),
    ExportColumn("Notes"),
]
