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


class FeedstockFuelTransportModeSchema(BaseSchema):
    feedstock_fuel_transport_mode_id: Optional[int] = None
    fuel_code_id: Optional[int] = None
    transport_mode_id: Optional[int] = None
    feedstock_fuel_transport_mode: Optional[TransportModeSchema] = None


class FinishedFuelTransportModeSchema(BaseSchema):
    finished_fuel_transport_mode_id: Optional[int] = None
    fuel_code_id: Optional[int] = None
    transport_mode_id: Optional[int] = None
    finished_fuel_transport_mode: Optional[TransportModeSchema] = None


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
    effective_date: Optional[date] = None
    expiration_date: Optional[date] = None
    fuel_type_id: int
    feedstock: str
    feedstock_location: str
    feedstock_misc: Optional[str] = None
    fuel_production_facility_location: Optional[str] = None
    facility_nameplate_capacity: Optional[int] = None
    former_company: Optional[str] = None
    notes: Optional[str] = None
    fuel_code_status: Optional[FuelCodeStatusSchema] = None
    fuel_code_prefix: Optional[FuelCodePrefixSchema] = None
    fuel_code_type: Optional[FuelTypeSchema] = None
    feedstock_fuel_transport_modes: Optional[List[FeedstockFuelTransportModeSchema]] = None
    finished_fuel_transport_modes: Optional[List[FinishedFuelTransportModeSchema]] = None


class FuelCodesSchema(BaseSchema):
    fuel_codes: List[FuelCodeSchema]
    pagination: PaginationResponseSchema


class FuelCodeCreateSchema(BaseSchema):
    id: Optional[str] = None
    fuel_code_id: Optional[int] = None
    status: str
    prefix: str
    prefix_id: int
    fuel_code: str
    company: str
    carbon_intensity: float
    edrms: str
    last_updated: date
    application_date: date
    approval_date: Optional[date] = None
    effective_date: Optional[date] = None
    expiration_date: Optional[date] = None
    fuel: str = None  # Fuel Type
    fuel_type_id: int
    feedstock: str
    feedstock_location: str
    feedstock_misc: Optional[str] = None
    fuel_production_facility_location: str
    facility_nameplate_capacity: Optional[int] = None
    feedstock_transport_mode: Optional[List[str]] = None
    finished_fuel_transport_mode: Optional[List[str]] = None
    feedstock_fuel_transport_modes: Optional[List[FeedstockFuelTransportModeSchema]] = (
        None
    )
    finished_fuel_transport_modes: Optional[List[FinishedFuelTransportModeSchema]] = (
        None
    )
    former_company: Optional[str] = None
    notes: Optional[str] = None
    is_valid: Optional[bool] = False
    validation_msg: Optional[str] = None
