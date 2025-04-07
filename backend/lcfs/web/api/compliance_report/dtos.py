from typing import Optional, List


from lcfs.web.api.base import BaseSchema
from lcfs.web.api.base import BaseSchema
from lcfs.web.api.fuel_supply.dtos import FuelSupplyDTO


class ChangelogItemBaseDTO(BaseSchema):
    compliance_report_id: int
    version: int
    nickname: str


class ChangelogFuelSuppliesItemDTO(ChangelogItemBaseDTO):
    fuel_supplies: Optional[List[FuelSupplyDTO]] = None
