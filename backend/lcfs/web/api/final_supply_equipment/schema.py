from datetime import date
from enum import Enum
from typing import Optional, List, Union

from pydantic import Field

from lcfs.utils.constants import POSTAL_REGEX
from lcfs.web.api.base import BaseSchema, PaginationResponseSchema
from lcfs.web.api.fuel_code.schema import EndUseTypeSchema, EndUserTypeSchema


class LevelOfEquipmentSchema(BaseSchema):
    level_of_equipment_id: int
    name: str
    description: Optional[str] = None
    display_order: int


class PortsEnum(str, Enum):
    SINGLE = "Single port"
    DUAL = "Dual port"


class FSEOptionsSchema(BaseSchema):
    intended_use_types: List[EndUseTypeSchema]
    levels_of_equipment: List[LevelOfEquipmentSchema]
    intended_user_types: List[EndUserTypeSchema]
    ports: List[PortsEnum]
    organization_names: List[str]


class FinalSupplyEquipmentCreateSchema(BaseSchema):
    final_supply_equipment_id: Optional[int] = None
    compliance_report_id: Optional[int] = None
    organization_name: str
    supply_from_date: date
    supply_to_date: date
    kwh_usage: Optional[float] = None
    serial_nbr: str
    manufacturer: str
    model: Optional[str] = None
    level_of_equipment: str
    ports: Optional[PortsEnum] = None
    intended_use_types: List[str]
    intended_user_types: List[str]
    street_address: str
    city: str
    postal_code: str = Field(pattern=POSTAL_REGEX)
    latitude: float
    longitude: float
    notes: Optional[str] = None
    deleted: Optional[bool] = None


class FinalSupplyEquipmentSchema(BaseSchema):
    final_supply_equipment_id: int
    compliance_report_id: int
    organization_name: str
    supply_from_date: date
    supply_to_date: date
    registration_nbr: str
    kwh_usage: Optional[float] = None
    serial_nbr: str
    manufacturer: str
    model: Optional[str] = None
    level_of_equipment: str
    ports: Optional[PortsEnum] = None
    intended_use_types: List[str]
    intended_user_types: List[str]
    street_address: str
    city: str
    postal_code: str
    latitude: float
    longitude: float
    notes: Optional[str] = None


class DeleteFinalSupplyEquipmentResponseSchema(BaseSchema):
    message: str


class FinalSupplyEquipmentsSchema(BaseSchema):
    final_supply_equipments: Optional[List[FinalSupplyEquipmentSchema]] = []
    pagination: Optional[PaginationResponseSchema] = {}


class FSEReportingSchema(BaseSchema):
    charging_equipment_compliance_id: Optional[int] = None
    charging_equipment_id: int
    charging_equipment_version: Optional[int] = None
    charging_site_id: int
    serial_number: str
    manufacturer: str
    model: Optional[str] = None
    site_name: str
    street_address: Optional[str] = None
    city: str
    postal_code: str
    latitude: float
    longitude: float
    level_of_equipment: str
    ports: Optional[PortsEnum] = None
    supply_from_date: Optional[date] = None
    supply_to_date: Optional[date] = None
    kwh_usage: Optional[float] = None
    compliance_notes: Optional[str] = None
    equipment_notes: Optional[str] = None
    compliance_report_id: Optional[int] = None
    compliance_report_group_uuid: Optional[str] = None
    organization_name: Optional[str] = None
    registration_number: Optional[str] = None
    intended_uses: Optional[List[str]] = []
    intended_users: Optional[List[str]] = []
    deleted: Optional[bool] = None
    power_output: Optional[float] = 0
    capacity_utilization_percent: Optional[int] = 0


class FSEReportingBaseSchema(BaseSchema):
    charging_equipment_compliance_id: Optional[int] = None
    supply_from_date: date
    supply_to_date: date
    kwh_usage: Optional[float] = 0
    compliance_notes: Optional[str] = None
    charging_equipment_id: int
    charging_equipment_version: Optional[int] = None
    organization_id: int
    compliance_report_id: int
    compliance_report_group_uuid: Optional[str] = None


class FSEReportingBatchSchema(BaseSchema):
    fse_reports: Union[List[FSEReportingBaseSchema], FSEReportingBaseSchema] = []
    compliance_report_id: int
    compliance_report_group_uuid: Optional[str] = None
    organization_id: int


class FSEReportingDefaultDates(BaseSchema):
    supply_from_date: Optional[date] = None
    supply_to_date: Optional[date] = None
    equipment_ids: List[int] = []
    compliance_report_id: int
    compliance_report_group_uuid: Optional[str] = None
    organization_id: int


class FSEReportingBatchDeleteSchema(BaseSchema):
    reporting_ids: List[int]
    compliance_report_id: int
    compliance_report_group_uuid: Optional[str] = None
    organization_id: int
