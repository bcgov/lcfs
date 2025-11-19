from lcfs.web.api.base import BaseSchema
from typing import Optional
from pydantic import Field


class FuelTypeSchema(BaseSchema):
    fuel_type_id: int
    fuel_type: str
    fossil_derived: Optional[bool] = None
    renewable: Optional[bool] = None
    unrecognized: Optional[bool] = None
    units: Optional[str] = None
    fuel_category_id: Optional[int] = None
    category: Optional[str] = None


class CalculatorQueryParams(BaseSchema):
    fuel_category_id: int = Field(..., alias="fuelCategoryId")
    fuel_type_id: int = Field(..., alias="fuelTypeId")
    end_use_id: Optional[int] = Field(None, alias="endUseId")
    quantity: float
    fuel_code_id: Optional[int] = Field(None, alias="fuelCodeId")
    use_custom_ci: bool = Field(False, alias="useCustomCi")
    custom_ci_value: Optional[float] = Field(None, alias="customCiValue")


class CalculatorQuantityQueryParams(BaseSchema):
    fuel_category_id: int = Field(..., alias="fuelCategoryId")
    fuel_type_id: int = Field(..., alias="fuelTypeId")
    end_use_id: Optional[int] = Field(None, alias="endUseId")
    compliance_units: float = Field(..., alias="complianceUnits")
    fuel_code_id: Optional[int] = Field(None, alias="fuelCodeId")
    use_custom_ci: bool = Field(False, alias="useCustomCi")
    custom_ci_value: Optional[float] = Field(None, alias="customCiValue")


class CreditsResultSchema(BaseSchema):
    rci: float
    tci: float | None
    eer: float
    energy_density: float | None
    uci: float | None
    quantity: float
    energy_content: float
    compliance_units: int
