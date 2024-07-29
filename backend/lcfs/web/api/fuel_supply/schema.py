from typing import List, Optional
from lcfs.web.api.base import (
    BaseSchema,
    FilterModel,
    PaginationResponseSchema,
    SortOrder,
)
from pydantic import Field


class CommmonPaginatedReportRequestSchema(BaseSchema):
    compliance_report_id: int = Field(..., alias="complianceReportId")
    filters: Optional[List[FilterModel]] = None
    page: Optional[int] = None
    size: Optional[int] = None
    sort_orders: Optional[List[SortOrder]] = None


class FuelCategorySchema(BaseSchema):
    fuel_category_id: int
    fuel_category: str
    default_and_prescribed_ci: Optional[float] = None


class ProvisionOfTheActSchema(BaseSchema):
    provision_of_the_act_id: int
    provision: str


class UnitOfMeasureSchema(BaseSchema):
    uom_id: int
    name: str


class EnergyDensitySchema(BaseSchema):
    energy_density_id: int
    energy_density: float
    unit: UnitOfMeasureSchema


class EndUseTypeSchema(BaseSchema):
    end_use_type_id: int
    end_use_type: str
    end_use_sub_type: Optional[str]


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


class FuelTypeSchema(BaseSchema):
    fuel_type_id: int
    fuel_type: str
    fossil_derived: bool
    default_carbon_intensity: float
    unit: str
    energy_density: Optional[EnergyDensitySchema]
    provisions: List[ProvisionOfTheActSchema]
    fuel_categories: List[FuelCategorySchema]
    eer_ratios: List[EnergyEffectivenessRatioSchema]
    target_carbon_intensities: List[TargetCarbonIntensitySchema]
    fuel_codes: Optional[List[FuelCodeSchema]] = []


class FuelTypeOptionsResponse(BaseSchema):
    fuel_types: List[FuelTypeSchema]


class FuelCategoryResponseSchema(BaseSchema):
    fuel_category_id: Optional[int] = None
    category: str


class FuelCodeStatusSchema(BaseSchema):
    fuel_code_status_id: Optional[int] = None
    status: str


class FuelCodeResponseSchema(BaseSchema):
    fuel_code_id: Optional[int] = None
    fuel_status_id: Optional[int] = None
    fuel_status: Optional[FuelCodeStatusSchema] = None
    prefix_id: Optional[int] = None
    fuel_code: str
    carbon_intensity: float


class FuelSupplySchema(BaseSchema):
    fuel_supply_id: Optional[int] = None
    compliance_report_id: Optional[int] = None
    quantity: Optional[int] = None
    compliance_units: Optional[int] = None
    energy: Optional[float] = None
    fuel_category_id: Optional[int] = None
    fuel_code_id: Optional[int] = None
    fuel_type_id: Optional[int] = None
    provision_of_the_act_id: Optional[int] = None
    custom_fuel_id: Optional[int] = None
    end_use_id: Optional[int] = None
    fuel_category: Optional[FuelCategoryResponseSchema] = None
    fuel_code: Optional[FuelCodeResponseSchema] = None


class DeleteFuelSupplyResponseSchema(BaseSchema):
    success: bool
    message: str


class FuelSuppliesSchema(BaseSchema):
    fuel_supplies: Optional[List[FuelSupplySchema]] = []
    pagination: Optional[PaginationResponseSchema] = {}
