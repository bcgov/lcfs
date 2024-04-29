from typing import Optional, List
from lcfs.web.api.base import BaseSchema, PaginationResponseSchema
from datetime import date, datetime
from enum import Enum

class FuelCodeStatusEnumSchema(str, Enum):
    Draft = "Draft"
    Approved = "Approved"
    Deleted = "Deleted"

class FuelTypeSchema(BaseSchema):
    fuel_type_id: int
    fuel_type: str
    fossil_derived: Optional[bool] = None

class FuelCodeStatusSchema(BaseSchema):
    fuel_code_status_id: Optional[int] = None
    status: FuelCodeStatusEnumSchema

class TransportModeSchema(BaseSchema):
    transport_mode_id: int
    transport_mode: str


class FuelCodePrefixSchema(BaseSchema):
    fuel_code_prefix_id: int
    prefix: str


class TableOptionsSchema(BaseSchema):
    fuel_types: List[FuelTypeSchema]
    transport_modes: List[TransportModeSchema]
    fuel_code_prefixes: List[FuelCodePrefixSchema]

class FuelCodeSchema(BaseSchema):
    fuel_code_id: Optional[int] = None
    fuel_status_id: Optional[int] = None
    prefix_id: int
    fuel_code: str
    company: str
    carbon_intensity: float
    edrms: str
    last_updated: date
    application_date: date
    approval_date: Optional[date] = None
    fuel_type_id: int
    feestock: str
    feedstock_location: str
    feedstock_misc: Optional[str] = None
    fuel_production_facility_location: Optional[str] = None
    facility_nameplate_capacity: Optional[str] = None
    feedstock_transport_mode_id: Optional[int] = None
    finished_fuel_transport_mode_id: Optional[int] = None
    former_company: Optional[str] = None
    notes: Optional[str] = None
    fuel_code_status: Optional[FuelCodeStatusSchema] = None
    fuel_code_prefix: Optional[FuelCodePrefixSchema] = None
    fuel_code_type: Optional[FuelTypeSchema] = None
    feedstock_transport_mode: Optional[TransportModeSchema] = None
    finished_fuel_transport_mode: Optional[TransportModeSchema] = None

class FuelCodesSchema(BaseSchema):
    fuel_codes: List[FuelCodeSchema]
    pagination: PaginationResponseSchema
