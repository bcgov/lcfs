from typing import Optional, List
from lcfs.web.api.base import BaseSchema, PaginationResponseSchema
from datetime import date
from pydantic import Field, field_validator
from enum import Enum


class FuelCodeStatusEnumSchema(str, Enum):
    Draft = "Draft"
    Approved = "Approved"
    Deleted = "Deleted"

class ProvisionOfTheActSchema(BaseSchema):
    provision_of_the_act_id: int
    name: str

class FuelTypeSchema(BaseSchema):
    fuel_type_id: int
    fuel_type: str
    fossil_derived: Optional[bool] = None
    provision_1_id: Optional[int] = None
    provision_2_id: Optional[int] = None
    default_carbon_intensity: Optional[float] = None
    provision_1: Optional[ProvisionOfTheActSchema] = None
    provision_2: Optional[ProvisionOfTheActSchema] = None

    @field_validator("default_carbon_intensity")
    def quantize_default_carbon_intensity(cls, value):
        return round(value, 2)


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


class UOMSchema(BaseSchema):
    uom_id: int
    name: str
    description: Optional[str] = None


class EndUseTypeSchema(BaseSchema):
    end_use_type_id: int
    type: str
    sub_type: Optional[str] = None


class EnergyDensitySchema(BaseSchema):
    energy_density_id: int
    density: float = Field(..., pre=True, always=True)

    fuel_type_id: int
    fuel_type: Optional[FuelTypeSchema] = None
    uom_id: int
    uom: Optional[UOMSchema] = None

    @field_validator("density")
    def quantize_density(cls, value):
        return round(value, 2)


class FuelCategorySchema(BaseSchema):
    fuel_category_id: int
    category: str
    description: Optional[str] = None


class EnergyEffectivenessRatioSchema(BaseSchema):
    eer_id: int
    fuel_category_id: int
    fuel_category: Optional[FuelCategorySchema] = None
    fuel_type_id: int
    fuel_type: Optional[FuelTypeSchema] = None
    end_use_type_id: Optional[int] = None
    end_use_type: Optional[EndUseTypeSchema] = None
    ratio: float = Field(..., pre=True, always=True)

    @field_validator("ratio")
    def quantize_ratio(cls, value):
        return round(value, 2)


class AdditionalCarbonIntensitySchema(BaseSchema):
    additional_uci_id: int
    fuel_type_id: Optional[int] = None
    fuel_type: Optional[FuelTypeSchema] = None
    end_use_type_id: Optional[int] = None
    end_use_type: Optional[EndUseTypeSchema] = None
    uom_id: Optional[int] = None
    uom: Optional[UOMSchema] = None
    intensity: float = Field(..., pre=True, always=True)

    @field_validator("intensity")
    def quantize_intensity(cls, value):
        return round(value, 2)


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
    feedstock_fuel_transport_modes: Optional[List[FeedstockFuelTransportModeSchema]] = (
        None
    )
    finished_fuel_transport_modes: Optional[List[FinishedFuelTransportModeSchema]] = (
        None
    )


class FieldOptions(BaseSchema):
    company: List[str]
    feedstock: List[str]
    feedstock_location: List[str]
    feedstock_misc: List[str]
    former_company: List[str]
    # cities: List[str]
    # provinces_states: List[str]
    # countries: List[str]


class TableOptionsSchema(BaseSchema):
    fuel_types: List[FuelTypeSchema]
    transport_modes: List[TransportModeSchema]
    fuel_code_prefixes: List[FuelCodePrefixSchema]
    latest_fuel_codes: List[FuelCodeSchema]
    field_options: FieldOptions


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
