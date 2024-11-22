from typing import Optional, List
from pydantic import Field, field_validator
from lcfs.web.api.base import (
    BaseSchema,
    FilterModel,
    SortOrder,
    PaginationRequestSchema,
    PaginationResponseSchema,
)
from enum import Enum


class FuelCodeStatusEnumSchema(str, Enum):
    Draft = "Draft"
    Approved = "Approved"
    Deleted = "Deleted"


class FuelTypeQuantityUnitsEnumSchema(str, Enum):
    Litres = "L"
    Kilograms = "kg"
    Kilowatt_hour = "kWh"
    Cubic_metres = "m³"

class FuelCodeSchema(BaseSchema):
    fuel_code_id: int
    fuel_code: str
    carbon_intensity: float


class ProvisionOfTheActSchema(BaseSchema):
    provision_of_the_act_id: int
    name: str


class UnitOfMeasureSchema(BaseSchema):
    uom_id: int
    name: str
    description: Optional[str] = None


class ExpectedUseTypeSchema(BaseSchema):
    expected_use_type_id: int
    name: str
    description: Optional[str] = None


class FuelTypeSchema(BaseSchema):
    fuel_type_id: int
    fuel_type: str
    fossil_derived: Optional[bool] = None
    provision_1_id: Optional[int] = None
    provision_2_id: Optional[int] = None
    default_carbon_intensity: Optional[float] = None
    fuel_codes: Optional[List[FuelCodeSchema]] = []
    provision_of_the_act: Optional[List[ProvisionOfTheActSchema]] = []
    units: FuelTypeQuantityUnitsEnumSchema

    @field_validator("default_carbon_intensity")
    def quantize_default_carbon_intensity(cls, value):
        return round(value, 2)


class FuelCategorySchema(BaseSchema):
    fuel_category_id: int
    category: str
    description: Optional[str] = None


class OtherUsesFuelCategorySchema(BaseSchema):
    fuel_category_id: int
    category: str
    description: Optional[str] = None


class OtherUsesTableOptionsSchema(BaseSchema):
    fuel_categories: List[OtherUsesFuelCategorySchema]
    fuel_types: List[FuelTypeSchema]
    units_of_measure: List[str]
    provisions_of_the_act: List[ProvisionOfTheActSchema]
    fuel_codes: List[FuelCodeSchema]
    expected_uses: List[ExpectedUseTypeSchema]


class OtherUsesCreateSchema(BaseSchema):
    other_uses_id: Optional[int] = None
    compliance_report_id: int
    quantity_supplied: int
    fuel_type: str
    fuel_category: str
    expected_use: str
    provision_of_the_act: str
    fuel_code: Optional[str] = None
    units: str
    ci_of_fuel: Optional[float] = None
    expected_use: str
    other_uses_id: Optional[int] = None
    rationale: Optional[str] = None
    deleted: Optional[bool] = None
    group_uuid: Optional[str] = None
    version: Optional[int] = None
    user_type: Optional[str] = None
    action_type: Optional[str] = None


class OtherUsesSchema(OtherUsesCreateSchema):
    pass


class PaginatedOtherUsesRequestSchema(BaseSchema):
    compliance_report_id: int = Field(..., alias="complianceReportId")
    filters: List[FilterModel]
    page: int
    size: int
    sort_orders: List[SortOrder]


class OtherUsesListSchema(BaseSchema):
    other_uses: List[OtherUsesSchema]
    pagination: PaginationResponseSchema


class OtherUsesAllSchema(BaseSchema):
    other_uses: List[OtherUsesSchema]


class DeleteOtherUsesSchema(BaseSchema):
    other_uses_id: int
    compliance_report_id: int


class DeleteOtherUsesResponseSchema(BaseSchema):
    message: str
