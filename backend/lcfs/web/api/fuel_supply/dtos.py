from typing import Optional

from lcfs.web.api.base import (
    Auditable,
    BaseSchema,
    Versioning,
)


class EndUseTypeDTO(BaseSchema):
    type: str


class ProvisionOfTheActDTO(BaseSchema):
    name: str


class FuelTypeDTO(BaseSchema):
    fuel_type: str


class FuelCodeDTO(BaseSchema):
    fuel_code: str


class FuelCategoryDTO(BaseSchema):
    category: str


class FuelSupplyDTO(BaseSchema, Auditable, Versioning):
    fuel_supply_id: int
    compliance_report_id: int
    quantity: int
    units: str

    compliance_units: Optional[float] = None
    target_ci: Optional[float] = None
    ci_of_fuel: Optional[float] = None
    energy_density: Optional[float] = None
    eer: Optional[float] = None
    uci: Optional[float] = None
    energy: Optional[float] = None
    fuel_type_other: Optional[str] = None

    fuel_category: Optional[FuelCategoryDTO] = None
    fuel_code: Optional[FuelCodeDTO] = None
    fuel_type: Optional[FuelTypeDTO] = None
    provision_of_the_act: Optional[ProvisionOfTheActDTO] = None
    end_use_type: Optional[EndUseTypeDTO] = None
