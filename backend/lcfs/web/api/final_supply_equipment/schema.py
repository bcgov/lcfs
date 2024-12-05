from typing import ClassVar, Optional, List
from datetime import date

from lcfs.web.api.base import BaseSchema, PaginationResponseSchema
from lcfs.web.api.compliance_report.schema import FinalSupplyEquipmentSchema
from lcfs.web.api.fuel_code.schema import EndUseTypeSchema, EndUserTypeSchema
from pydantic import Field
from enum import Enum


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


class PortsEnum(str, Enum):
    SINGLE = "Single port"
    DUAL = "Dual port"


class FSEOptionsSchema(BaseSchema):
    intended_use_types: List[EndUseTypeSchema]
    fuel_measurement_types: List[FuelMeasurementTypeSchema]
    levels_of_equipment: List[LevelOfEquipmentSchema]
    intended_user_types: List[EndUserTypeSchema]
    ports: List[PortsEnum]
    organizations: List[str]


class FinalSupplyEquipmentCreateSchema(BaseSchema):
    final_supply_equipment_id: Optional[int] = None
    compliance_report_id: Optional[int] = None
    organization: str
    supply_from_date: date
    supply_to_date: date
    kwh_usage: float
    serial_nbr: str
    manufacturer: str
    model: Optional[str] = None
    level_of_equipment: str
    ports: Optional[PortsEnum] = None
    fuel_measurement_type: str
    intended_uses: List[str]
    intended_users: List[str]
    street_address: str
    city: str
    postal_code: str = Field(pattern=r"^[A-Za-z]\d[A-Za-z] \d[A-Za-z]\d$")
    latitude: float
    longitude: float
    notes: Optional[str] = None
    deleted: Optional[bool] = None


class DeleteFinalSupplyEquipmentResponseSchema(BaseSchema):
    message: str


class FinalSupplyEquipmentsSchema(BaseSchema):
    final_supply_equipments: Optional[List[FinalSupplyEquipmentSchema]] = []
    pagination: Optional[PaginationResponseSchema] = {}
