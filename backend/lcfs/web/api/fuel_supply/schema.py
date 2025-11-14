from typing import List, Optional

from pydantic import Field, ValidationInfo, field_validator, model_validator

from lcfs.web.api.base import (
    BaseSchema,
    FilterModel,
    PaginationResponseSchema,
    SortOrder,
)
from lcfs.web.api.fuel_type.schema import FuelTypeQuantityUnitsEnumSchema
from lcfs.web.utils.schema_validators import fuel_code_required, fuel_quantity_required
from sqlalchemy import Enum


class ModeEnum(str, Enum):
    VIEW = "view"
    EDIT = "edit"
    CHANGELOG = "changelog"


class CommonPaginatedReportRequestSchema(BaseSchema):
    compliance_report_id: int = Field(..., alias="complianceReportId")
    changelog: Optional[bool] = None
    mode: Optional[str] = ModeEnum.VIEW
    filters: Optional[List[FilterModel]] = None
    page: Optional[int] = None
    size: Optional[int] = None
    sort_orders: Optional[List[SortOrder]] = None


class FuelCategorySchema(BaseSchema):
    fuel_category_id: int
    fuel_category: str
    default_and_prescribed_ci: Optional[float] = None

    @field_validator("default_and_prescribed_ci")
    def quantize_default_carbon_intensity(cls, value):
        if value is not None:
            return round(value, 2)
        return value


class ProvisionOfTheActSchema(BaseSchema):
    provision_of_the_act_id: int
    name: str


class UnitOfMeasureSchema(BaseSchema):
    uom_id: int
    name: str


class EnergyDensitySchema(BaseSchema):
    energy_density_id: int
    energy_density: float
    unit: UnitOfMeasureSchema


class EndUseTypeSchema(BaseSchema):
    end_use_type_id: int
    type: str
    sub_type: Optional[str] = None


class EnergyEffectivenessRatioSchema(BaseSchema):
    eer_id: Optional[int]
    fuel_category: FuelCategorySchema
    end_use_type: Optional[EndUseTypeSchema]
    energy_effectiveness_ratio: float


class TargetCarbonIntensitySchema(BaseSchema):
    target_carbon_intensity_id: int
    target_carbon_intensity: float
    reduction_target_percentage: float
    fuel_category: FuelCategorySchema
    compliance_period: str


class FuelCodeSchema(BaseSchema):
    fuel_code_id: int
    fuel_code_prefix_id: int
    fuel_code: str
    fuel_code_carbon_intensity: float
    fuel_production_facility_country: Optional[str] = None


class FuelTypeOptionsSchema(BaseSchema):
    fuel_type_id: int
    fuel_type: str
    fossil_derived: bool
    renewable: bool
    default_carbon_intensity: Optional[float] = None
    unit: str
    unrecognized: bool
    energy_density: Optional[EnergyDensitySchema]
    provisions: List[ProvisionOfTheActSchema]
    fuel_categories: List[FuelCategorySchema]
    eer_ratios: List[EnergyEffectivenessRatioSchema]
    target_carbon_intensities: List[TargetCarbonIntensitySchema]
    fuel_codes: Optional[List[FuelCodeSchema]] = []

    @field_validator("default_carbon_intensity")
    def quantize_default_carbon_intensity(cls, value):
        if value is not None:
            return round(value, 2)
        return value


class FuelTypeOptionsResponse(BaseSchema):
    fuel_types: List[FuelTypeOptionsSchema]


class FuelTypeSchema(BaseSchema):
    fuel_type_id: int
    fuel_type: str
    fossil_derived: Optional[bool] = None
    provision_1_id: Optional[int] = None
    provision_2_id: Optional[int] = None
    default_carbon_intensity: Optional[float] = None
    units: FuelTypeQuantityUnitsEnumSchema

    @field_validator("default_carbon_intensity")
    def quantize_default_carbon_intensity(cls, value):
        if value is not None:
            return round(value, 2)
        return value


class FuelCategoryResponseSchema(BaseSchema):
    fuel_category_id: Optional[int] = None
    category: str


class FuelSupplyCreateUpdateSchema(BaseSchema):
    compliance_report_id: int
    fuel_supply_id: Optional[int] = None
    group_uuid: Optional[str] = None
    version: Optional[int] = None
    fuel_type_id: int
    fuel_category_id: int
    end_use_id: int
    provision_of_the_act_id: int
    quantity: Optional[int] = None
    q1_quantity: Optional[int] = None
    q2_quantity: Optional[int] = None
    q3_quantity: Optional[int] = None
    q4_quantity: Optional[int] = None
    units: str
    fuel_type_other: Optional[str] = None
    fuel_code_id: Optional[int] = None
    target_ci: Optional[float] = None
    ci_of_fuel: Optional[float] = None
    energy_density: Optional[float] = None
    eer: Optional[float] = None
    energy: Optional[float] = None
    deleted: Optional[bool] = None
    is_new_supplemental_entry: Optional[bool] = None
    is_canada_produced: Optional[bool] = False
    is_q1_supplied: Optional[bool] = False

    class Config:
        use_enum_values = True

    @model_validator(mode="before")
    @classmethod
    def check_fuel_code_required(cls, values):
        return fuel_code_required(values)

    @model_validator(mode="before")
    @classmethod
    def check_quantity_required(cls, values, info: ValidationInfo):
        if isinstance(values, DeleteFuelSupplyResponseSchema) or (
            info.context and info.context.get("skip_quantity_validation")
        ):
            return values
        return fuel_quantity_required(values)


class FuelSupplyResponseSchema(FuelSupplyCreateUpdateSchema):
    action_type: str
    fuel_type: str
    fuel_category: str
    end_use_id: Optional[int] = None
    end_use_type: Optional[str] = None
    provision_of_the_act: Optional[str] = None
    compliance_units: Optional[int] = None

    fuel_code: Optional[str]
    uci: Optional[float] = None
    fuel_code: Optional[str] = None

    @field_validator("compliance_units", mode="before")
    def round_compliance_units(cls, value):
        if value is not None:
            return round(value)
        return value


class DeleteFuelSupplyResponseSchema(BaseSchema):
    success: bool
    message: str


class FuelSuppliesSchema(BaseSchema):
    fuel_supplies: Optional[List[FuelSupplyResponseSchema]] = []
    pagination: Optional[PaginationResponseSchema] = {}


# Organization Fuel Supply Schemas
class OrganizationFuelSupplySchema(BaseSchema):
    """Schema for organization fuel supply history records"""
    fuel_supply_id: int
    compliance_period: str
    report_submission_date: Optional[str] = None
    fuel_type: str
    fuel_category: str
    provision_of_the_act: str
    fuel_code: Optional[str] = None
    fuel_quantity: int
    units: str
    compliance_report_id: int


class FuelSupplyAnalyticsSchema(BaseSchema):
    """Analytics data for fuel supply"""
    total_volume: int
    total_fuel_types: int
    total_reports: int
    most_recent_submission: Optional[str] = None
    total_by_fuel_type: dict = {}
    total_by_year: dict = {}
    total_by_fuel_category: dict = {}
    total_by_provision: dict = {}


class OrganizationFuelSuppliesSchema(BaseSchema):
    """Response schema for organization fuel supply with analytics"""
    fuel_supplies: List[OrganizationFuelSupplySchema]
    analytics: FuelSupplyAnalyticsSchema
    pagination: PaginationResponseSchema
