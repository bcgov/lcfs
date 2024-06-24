from typing import Optional, List, Union
from datetime import datetime, date
from lcfs.web.api.fuel_code.schema import EndUseTypeSchema

from lcfs.web.api.base import BaseSchema
from lcfs.web.api.base import PaginationResponseSchema
from pydantic import Field

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


class OtherUsesBaseSchema(BaseSchema):
    compliance_report_id: int
    fuel_type_id: int
    fuel_category_id: int
    quantity_supplied: int = Field(..., ge=0)
    units: str
    expected_use_id: int
    rationale: Optional[str] = None


class OtherUsesSchema(OtherUsesBaseSchema):
    other_uses_id: int


class FuelMeasurementTypeSchema(BaseSchema):
    fuel_measurement_type_id: int
    type: str
    description: Optional[str] = None
    display_order: int


class LevelOfEquipmentSchema(BaseSchema):
    level_of_equipment_id: int
    name: str
    description: Optional[str] = None
    display_order: int


class FSEOptionsSchema(BaseSchema):
    intended_use_types: List[EndUseTypeSchema]
    fuel_measurement_types: List[FuelMeasurementTypeSchema]
    levels_of_equipment: List[LevelOfEquipmentSchema]


class FinalSupplyEquipmentSchema(BaseSchema):
    final_supply_equipment_id: Optional[int] = None
    compliance_report_id: Optional[int] = None
    supply_from_date: date
    supply_to_date: date
    serial_nbr: str
    manufacturer: str
    level_of_equipment: str
    fuel_measurement_type: str
    intended_use: str
    street_address: str
    city: str
    postal_code: str
    latitude: float
    longitude: float
    notes: Optional[str] = None


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
