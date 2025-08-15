import json
from typing import Any, Dict, Optional, List, Union

from fastapi.exceptions import RequestValidationError

from lcfs.web.api.base import BaseSchema, PaginationResponseSchema
from datetime import date, datetime
from pydantic import (
    Field,
    field_validator,
    model_validator,
)
from enum import Enum

from lcfs.web.api.common.schema import CompliancePeriodBaseSchema
from lcfs.web.api.fuel_type.schema import FuelTypeQuantityUnitsEnumSchema
from lcfs.web.utils.schema_validators import fuel_suffix_format_validator


class FuelCodeStatusEnumSchema(str, Enum):
    Draft = "Draft"
    Recommended = "Recommended"
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
    units: FuelTypeQuantityUnitsEnumSchema

    @field_validator("default_carbon_intensity")
    def quantize_default_carbon_intensity(cls, value):
        if value is not None:
            return round(value, 2)
        return value


class FuelCodeStatusSchema(BaseSchema):
    fuel_code_status_id: Optional[int] = None
    status: FuelCodeStatusEnumSchema


class FuelCodeResponseSchema(BaseSchema):
    fuel_code_id: Optional[int] = None
    fuel_status_id: Optional[int] = None
    fuel_status: Optional[FuelCodeStatusSchema] = None
    prefix_id: Optional[int] = None
    fuel_code: str
    carbon_intensity: float


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
    compliance_period_id: int
    compliance_period: CompliancePeriodBaseSchema
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
    facility_nameplate_capacity_unit: Optional[Union[FuelTypeQuantityUnitsEnumSchema, str]] = None
    former_company: Optional[str] = None
    notes: Optional[str] = None
    fuel_code_status: Optional[FuelCodeStatusSchema] = None
    fuel_code_prefix: Optional[FuelCodePrefixSchema] = None
    fuel_type: Optional[FuelTypeSchema] = None
    feedstock_fuel_transport_modes: Optional[List[FeedstockFuelTransportModeSchema]] = (
        None
    )
    finished_fuel_transport_modes: Optional[List[FinishedFuelTransportModeSchema]] = (
        None
    )
    group_uuid: Optional[str] = None
    version: Optional[int] = 0
    action_type: Optional[str] = None
    is_notes_required: Optional[bool] = False
    can_edit_ci: Optional[bool] = True

class FuelCodeHistorySchema(BaseSchema):
    fuel_code_history_id: int
    fuel_code_id: int
    fuel_status_id: int
    fuel_code_snapshot: Optional[Dict[str, Any]] = Field(
        None,
        description="Complete snapshot of fuel code data at time of change"
    )
    group_uuid: Optional[str] = None
    version: Optional[int] = 0
    action_type: Optional[str] = None

    @field_validator('fuel_code_snapshot', mode='before')
    @classmethod
    def parse_fuel_code_snapshot(cls, v):
        """Parse fuel_code_snapshot if it comes as a JSON string"""
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return None
        return v


class FuelCodeBaseSchema(BaseSchema):
    fuel_code_id: Optional[int] = None
    prefix_id: int = Field(..., alias="fuel_code_prefix_id")
    prefix: str
    fuel_suffix: str
    fuel_status_id: int = Field(..., alias="fuel_code_status_id")
    status: Optional[str] = None
    fuel_type_id: int
    fuel_type: str
    company: str
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    carbon_intensity: float
    edrms: str
    last_updated: datetime
    application_date: datetime
    approval_date: Optional[datetime] = None
    create_date: Optional[datetime] = None
    effective_date: Optional[datetime] = None
    expiration_date: Optional[datetime] = None
    effective_status: Optional[bool] = None
    feedstock: str
    feedstock_location: str
    feedstock_misc: Optional[str] = None
    fuel_production_facility_city: Optional[str] = None
    fuel_production_facility_province_state: Optional[str] = None
    fuel_production_facility_country: Optional[str] = None
    facility_nameplate_capacity: Optional[int] = None
    facility_nameplate_capacity_unit: Optional[str] = None
    former_company: Optional[str] = None
    finished_fuel_transport_modes: Optional[List[str]] = None
    feedstock_fuel_transport_modes: Optional[List[str]] = None
    notes: Optional[str] = None


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
    fuel_type: Optional[FuelTypeSchema] = None
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
    fuel_codes: List[FuelCodeBaseSchema]
    pagination: Optional[PaginationResponseSchema] = None


class FuelCodeCreateUpdateSchema(BaseSchema):
    fuel_code_id: Optional[int] = None
    prefix_id: int = None
    fuel_suffix: str
    carbon_intensity: float
    edrms: str
    company: str
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    application_date: date
    approval_date: date
    effective_date: date
    expiration_date: date
    fuel_type_id: int
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
    @classmethod
    def model_validations(cls, values):
        values = fuel_suffix_format_validator(values)
        return values

    @model_validator(mode="after")
    def check_capacity_and_unit(self):
        facility_nameplate_capacity = self.facility_nameplate_capacity
        facility_nameplate_capacity_unit = self.facility_nameplate_capacity_unit

        if facility_nameplate_capacity is None:
            self.facility_nameplate_capacity = None
        elif (
            facility_nameplate_capacity is not None
            and facility_nameplate_capacity_unit is None
        ):
            errors = [
                {
                    "loc": ("facilityNameplateCapacityUnit",),
                    "msg": "must be provided when the facility nameplate capacity is set",
                    "type": "value_error",
                }
            ]
            raise RequestValidationError(errors)
        return self

    @model_validator(mode="after")
    def validate_dates(self):
        application_date = self.application_date
        approval_date = self.approval_date
        effective_date = self.effective_date
        expiration_date = self.expiration_date

        errors = []

        # Application Date: Must be before Approval Date and Expiry Date
        if application_date >= approval_date:
            errors.append(
                {
                    "loc": ("applicationDate",),
                    "msg": "must be before Approval Date.",
                    "type": "value_error",
                }
            )
        if application_date >= expiration_date:
            errors.append(
                {
                    "loc": ("applicationDate",),
                    "msg": "must be before Expiration Date.",
                    "type": "value_error",
                }
            )

        # Approval Date: Must be after Application Date
        if approval_date <= application_date:
            errors.append(
                {
                    "loc": ("approvalDate",),
                    "msg": "must be after Application Date.",
                    "type": "value_error",
                }
            )

        # Effective Date: Must be on/after Application Date and before Expiry Date
        if effective_date < application_date:
            errors.append(
                {
                    "loc": ("effectiveDate",),
                    "msg": "must be on or after Application Date.",
                    "type": "value_error",
                }
            )
        if expiration_date and effective_date >= expiration_date:
            errors.append(
                {
                    "loc": ("effectiveDate",),
                    "msg": "must be before Expiry Date.",
                    "type": "value_error",
                }
            )

        # Expiry Date: Must be after Effective Date
        if expiration_date <= effective_date:
            errors.append(
                {
                    "loc": ("expirationDate",),
                    "msg": "must be after Effective Date.",
                    "type": "value_error",
                }
            )

        # Raise RequestValidationError if any errors exist
        if errors:
            raise RequestValidationError(errors)

        return self


class DeleteFuelCodeResponseSchema(BaseSchema):
    message: str