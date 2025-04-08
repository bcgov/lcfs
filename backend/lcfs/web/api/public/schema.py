from lcfs.web.api.base import BaseSchema
from typing import Optional


class FuelTypeSchema(BaseSchema):
    fuel_type_id: int
    fuel_type: str
    fossil_derived: Optional[bool] = None
    renewable: Optional[bool] = None
    unrecognized: Optional[bool] = None
    units: Optional[str] = None
    fuel_category_id: Optional[int] = None
    category: Optional[str] = None
