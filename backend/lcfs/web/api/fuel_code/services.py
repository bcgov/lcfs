from logging import getLogger
from fastapi import Depends

from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.core.decorators import service_handler

from lcfs.web.api.fuel_code.schema import FuelTypeSchema, TransportModeSchema, FuelCodePrefixSchema, TableOptionsSchema

logger = getLogger("fuel_code_services")


class FuelCodeServices:
    def __init__(self, repo: FuelCodeRepository = Depends(FuelCodeRepository)) -> None:
        self.repo = repo

    @service_handler
    async def get_table_options(self) -> TableOptionsSchema:
        """
        Gets the list of table options related to fuel codes.
        """
        fuel_types = await self.repo.get_fuel_types()
        transport_modes = await self.repo.get_transport_modes()
        fuel_code_prefixes = await self.repo.get_fuel_code_prefixes()

        return {
            "fuelTypes": [FuelTypeSchema.model_validate(fuel_type) for fuel_type in fuel_types],
            "transportModes":  [TransportModeSchema.model_validate(transport_mode) for transport_mode in transport_modes],
            "fuelCodePrefixes": [FuelCodePrefixSchema.model_validate(fuel_code_prefix) for fuel_code_prefix in fuel_code_prefixes],
        }
