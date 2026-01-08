from datetime import date
from typing import List, Optional

from pydantic import Field, field_validator, model_validator

from lcfs.web.api.base import (
    BaseSchema,
    FilterModel,
    PaginationResponseSchema,
    SortOrder,
)
from lcfs.web.api.fuel_code.schema import FuelCodeResponseSchema
from lcfs.web.api.fuel_type.schema import FuelTypeQuantityUnitsEnumSchema
from lcfs.web.utils.schema_validators import (
    fuel_code_required,
    unknown_provision_requires_date,
    quantity_must_be_positive,
    energy_must_be_within_range,
)


class CommonPaginatedReportRequestSchema(BaseSchema):
    compliance_report_id: int = Field(..., alias="complianceReportId")
    changelog: Optional[bool] = None
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
    fuel_code_effective_date: Optional[date] = None
    fuel_code_expiration_date: Optional[date] = None
    fuel_production_facility_country: Optional[str] = None


class FuelTypeOptionsSchema(BaseSchema):
    fuel_type_id: int
    fuel_type: str
    fossil_derived: bool
    default_carbon_intensity: Optional[float] = None
    unit: str
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


class FuelExportSchema(BaseSchema):
    fuel_export_id: Optional[int] = None
    compliance_report_id: int
    export_date: Optional[date] = None
    group_uuid: Optional[str] = None
    version: Optional[int] = None
    action_type: Optional[str] = None
    compliance_period: Optional[str] = None
    fuel_type_id: int
    fuel_type: FuelTypeSchema
    fuel_category_id: int
    fuel_category: FuelCategoryResponseSchema
    end_use_id: Optional[int] = None
    end_use_type: Optional[EndUseTypeSchema] = None
    provision_of_the_act_id: int
    provision_of_the_act: ProvisionOfTheActSchema
    fuel_type_other: Optional[str] = None
    quantity: int = Field(..., gt=0)
    units: str
    compliance_units: Optional[int] = 0
    target_ci: Optional[float] = None
    ci_of_fuel: Optional[float] = None
    uci: Optional[float] = None
    energy_density: Optional[float] = None
    eer: Optional[float] = None
    energy: Optional[float] = None
    fuel_code_id: Optional[int] = None
    fuel_code: Optional[FuelCodeResponseSchema] = None
    updated: Optional[bool] = None

    @field_validator("compliance_units", mode="before")
    def round_compliance_units(cls, value):
        if value is not None:
            return round(value)
        return value


class FuelExportCreateUpdateSchema(BaseSchema):
    fuel_export_id: Optional[int] = None
    compliance_report_id: int
    export_date: Optional[date] = None
    group_uuid: Optional[str] = None
    version: Optional[int] = None
    action_type: Optional[str] = None
    fuel_type_other: Optional[str] = None
    fuel_type_id: int
    fuel_category_id: int
    end_use_id: int
    provision_of_the_act: Optional[str] = None
    provision_of_the_act_id: int
    fuel_code_id: Optional[int] = None
    quantity: int = Field(..., gt=0)
    units: str
    compliance_units: Optional[int] = 0
    target_ci: Optional[float] = 0
    ci_of_fuel: Optional[float] = 0
    energy_density: Optional[float] = 0
    eer: Optional[float] = 0
    energy: Optional[float] = 0
    deleted: Optional[bool] = None
    is_new_supplemental_entry: Optional[bool] = None

    @model_validator(mode="before")
    @classmethod
    def model_validations(cls, values):
        values = fuel_code_required(values)
        values = unknown_provision_requires_date(values)
        values = quantity_must_be_positive(values)
        values = energy_must_be_within_range(values)
        return values


class DeleteFuelExportResponseSchema(BaseSchema):
    message: str


class FuelExportsSchema(BaseSchema):
    fuel_exports: Optional[List[FuelExportSchema]] = []
    pagination: Optional[PaginationResponseSchema] = None
    total_compliance_units: Optional[int] = None
