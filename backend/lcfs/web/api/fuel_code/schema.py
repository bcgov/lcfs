from typing import Optional, List
from lcfs.web.api.base import BaseSchema


class FuelTypeSchema(BaseSchema):
    fuel_type_id: int
    fuel_type: str
    fossil_derived: Optional[bool] = None


class TransportModeSchema(BaseSchema):
    transport_mode_id: int
    transport_mode: str


class FuelCodePrefixSchema(BaseSchema):
    fuel_code_prefix_id: int
    prefix: str


class TableOptionsSchema(BaseSchema):
    fuelTypes: List[FuelTypeSchema]
    transportModes: List[TransportModeSchema]
    fuelCodePrefixes: List[FuelCodePrefixSchema]
