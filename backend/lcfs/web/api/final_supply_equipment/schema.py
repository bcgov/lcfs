from datetime import date
from enum import Enum
from typing import Optional, List

from pydantic import Field

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
    intended_uses: List[str]
    intended_users: List[str]
    street_address: str
    city: str
    postal_code: str = Field(pattern=r"^[A-Za-z]\d[A-Za-z] \d[A-Za-z]\d$")
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
    level_of_equipment: LevelOfEquipmentSchema
    ports: Optional[PortsEnum] = None
    intended_use_types: List[EndUseTypeSchema]
    intended_user_types: List[EndUserTypeSchema]
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
