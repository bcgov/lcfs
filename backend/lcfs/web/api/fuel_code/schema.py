from typing import Optional, List, Union
from lcfs.web.api.base import BaseSchema, PaginationResponseSchema
from datetime import date, datetime
from pydantic import Field, ValidationError, field_validator, model_validator
from enum import Enum


class FuelCodeStatusEnumSchema(str, Enum):
    Draft = "Draft"
    Approved = "Approved"
    Deleted = "Deleted"


class FuelTypeQuantityUnitsEnumSchema(str, Enum):
    Litres = "L"
    Kilograms = "kg"
    Kilowatt_hour = "kWh"
    Cubic_metres = "m3"


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
    units: FuelTypeQuantityUnitsEnumSchema

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
    next_fuel_code: Optional[str] = None
    prefix: str


class UOMSchema(BaseSchema):
    uom_id: int
    name: str
    description: Optional[str] = None


class EndUseTypeSchema(BaseSchema):
    end_use_type_id: int
    type: str
    sub_type: Optional[str] = None

class EndUserTypeSchema(BaseSchema):
    end_user_type_id: int
    type_name: str


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
    fuel_suffix: str
    company: str
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    carbon_intensity: float
    edrms: str
    last_updated: datetime
    application_date: date
    approval_date: Optional[date] = None
    effective_date: Optional[date] = None
    expiration_date: Optional[date] = None
    fuel_type_id: int
    feedstock: str
    feedstock_location: str
    feedstock_misc: Optional[str] = None
    fuel_production_facility_city: Optional[str] = None
    fuel_production_facility_province_state: Optional[str] = None
    fuel_production_facility_country: Optional[str] = None
    facility_nameplate_capacity: Optional[int] = None
    facility_nameplate_capacity_unit: Optional[FuelTypeQuantityUnitsEnumSchema] = None
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


class FuelCodeCloneSchema(BaseSchema):
    fuel_code_id: Optional[int] = None
    fuel_status_id: Optional[int] = None
    prefix_id: Optional[int] = None
    fuel_suffix: Optional[str] = None
    company: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    carbon_intensity: Optional[float] = None
    edrms: Optional[str] = None
    last_updated: Optional[datetime] = None
    application_date: Optional[date] = None
    approval_date: Optional[date] = None
    effective_date: Optional[date] = None
    expiration_date: Optional[date] = None
    fuel_type_id: Optional[int] = None
    feedstock: Optional[str] = None
    feedstock_location: Optional[str] = None
    feedstock_misc: Optional[str] = None
    fuel_production_facility_city: Optional[str] = None
    fuel_production_facility_province_state: Optional[str] = None
    fuel_production_facility_country: Optional[str] = None
    facility_nameplate_capacity: Optional[int] = None
    facility_nameplate_capacity_unit: Optional[FuelTypeQuantityUnitsEnumSchema] = None
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
    contact_name: List[str]
    contact_email: List[str]


class FPLocationsSchema(BaseSchema):
    fuel_production_facility_city: Optional[str] = None
    fuel_production_facility_province_state: Optional[str] = None
    fuel_production_facility_country: Optional[str] = None


class TableOptionsSchema(BaseSchema):
    fuel_types: List[FuelTypeSchema]
    transport_modes: List[TransportModeSchema]
    fuel_code_prefixes: List[FuelCodePrefixSchema]
    latest_fuel_codes: Optional[List[FuelCodeSchema]]
    field_options: FieldOptions
    fp_locations: List[FPLocationsSchema]
    facility_nameplate_capacity_units: List[FuelTypeQuantityUnitsEnumSchema]


class SearchFuelCodeList(BaseSchema):
    fuel_codes: Union[List[str], List[FuelCodeCloneSchema]]


class FuelCodesSchema(BaseSchema):
    fuel_codes: List[FuelCodeSchema]
    pagination: Optional[PaginationResponseSchema] = None


class FuelCodeCreateSchema(BaseSchema):
    id: Optional[str] = None
    fuel_code_id: Optional[int] = None
    status: Optional[str] = None
    prefix: str
    prefix_id: Optional[int] = None
    fuel_suffix: str
    carbon_intensity: float
    edrms: str
    company: str
    last_updated: Optional[datetime] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    application_date: date
    approval_date: Optional[date] = None
    effective_date: Optional[date] = None
    expiration_date: Optional[date] = None
    fuel: str
    fuel_type_id: Optional[int] = None
    feedstock: str
    feedstock_location: str
    feedstock_misc: Optional[str] = None
    fuel_production_facility_city: str
    fuel_production_facility_province_state: str
    fuel_production_facility_country: str

    facility_nameplate_capacity: Optional[int] = None
    facility_nameplate_capacity_unit: Optional[
        Union[FuelTypeQuantityUnitsEnumSchema, str]
    ] = None
    feedstock_fuel_transport_mode: Optional[List[str]] = None
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
    deleted: Optional[bool] = None

    @model_validator(mode="before")
    def check_capacity_and_unit(cls, values):
        facility_nameplate_capacity = values.get("facility_nameplate_capacity")
        facility_nameplate_capacity_unit = values.get("facility_nameplate_capacity_unit")

        if facility_nameplate_capacity is None:
            values["facility_nameplate_capacity_unit"] = None
        elif (
            facility_nameplate_capacity is not None
            and facility_nameplate_capacity_unit is None
        ):
            raise ValidationError(
                "facility_nameplate_capacity_unit must be provided when facility_nameplate_capacity is not None"
            )
        return values


class DeleteFuelCodeResponseSchema(BaseSchema):
    message: str
