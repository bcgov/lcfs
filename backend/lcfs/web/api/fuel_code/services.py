from logging import getLogger
import math
from typing import List
from fastapi import Depends
from datetime import datetime

from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.core.decorators import service_handler
from lcfs.web.api.base import PaginationRequestSchema, PaginationResponseSchema
from lcfs.db.models.FeedstockFuelTransportMode import FeedstockFuelTransportMode
from lcfs.db.models.FinishedFuelTransportMode import FinishedFuelTransportMode
from lcfs.db.models.FuelCode import FuelCode
from lcfs.db.models.FuelCodeStatus import FuelCodeStatus
from lcfs.web.api.fuel_code.schema import (
    AdditionalCarbonIntensitySchema,
    EnergyDensitySchema,
    EnergyEffectivenessRatioSchema,
    FuelCodeCreateSchema,
    FuelCodeSchema,
    FuelCodesSchema,
    FuelTypeSchema,
    TransportModeSchema,
    FuelCodePrefixSchema,
    TableOptionsSchema,
)
from lcfs.web.exception.exceptions import DataNotFoundException

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
        latest_fuel_codes = await self.repo.get_latest_fuel_codes()

        return {
            "fuelTypes": [
                FuelTypeSchema.model_validate(fuel_type) for fuel_type in fuel_types
            ],
            "transportModes": [
                TransportModeSchema.model_validate(transport_mode)
                for transport_mode in transport_modes
            ],
            "fuelCodePrefixes": [
                FuelCodePrefixSchema.model_validate(fuel_code_prefix)
                for fuel_code_prefix in fuel_code_prefixes
            ],
            "latestFuelCodes": latest_fuel_codes
        }

    @service_handler
    async def get_fuel_codes(
        self, pagination: PaginationRequestSchema
    ) -> FuelCodesSchema:
        """
        Gets the list of fuel codes.
        """
        fuel_codes, total_count = await self.repo.get_fuel_codes_paginated(pagination)

        if len(fuel_codes) == 0:
            raise DataNotFoundException("No fuel codes found")
        return FuelCodesSchema(
            pagination=PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=math.ceil(total_count / pagination.size),
            ),
            fuel_codes=[
                FuelCodeSchema.model_validate(fuel_code) for fuel_code in fuel_codes
            ],
        )

    async def convert_to_model(self, fuel_code: FuelCodeCreateSchema) -> FuelCode:
        """
        converts data from FuelCodeCreateSchema to FuelCode data model to store into database.
        """
        fc = FuelCode(
            **fuel_code.model_dump(
                exclude={
                    "id",
                    "prefix",
                    "fuel",
                    "feedstock_transport_mode",
                    "finished_fuel_transport_mode",
                    "feedstock_fuel_transport_modes",
                    "finished_fuel_transport_modes",
                    "status",
                    "is_valid",
                    "validation_msg",
                    "fuel_code",
                }
            )
        )
        fc.fuel_code_status = await self.repo.get_fuel_status_by_status(
            fuel_code.status
        )
        fc.fuel_code = str(fuel_code.fuel_code)
        fc.feedstock_fuel_transport_modes = [
            FeedstockFuelTransportMode(
                fuel_code_id=fc.fuel_code_id,
                transport_mode_id=item.transport_mode_id,
            )
            for item in fuel_code.feedstock_fuel_transport_modes
        ]
        fc.finished_fuel_transport_modes = [
            FinishedFuelTransportMode(
                fuel_code_id=fc.fuel_code_id,
                transport_mode_id=item.transport_mode_id,
            )
            for item in fuel_code.finished_fuel_transport_modes
        ]
        return fc

    @service_handler
    async def save_fuel_codes(self, fuel_codes: List[FuelCodeCreateSchema]) -> str:
        """
        Saves the list of fuel codes.
        """
        logger.info(f"Saving {len(fuel_codes)} fuel code(s)")
        fuel_code_models = []
        for fuel_code in fuel_codes:
            fuel_code_models.append(await self.convert_to_model(fuel_code))
        if len(fuel_code_models) > 0:
            return await self.repo.save_fuel_codes(fuel_code_models)

    @service_handler
    async def get_fuel_code(self, fuel_code_id: int):
        return await self.repo.get_fuel_code(fuel_code_id)

    async def get_fuel_code_status(self, fuel_code_status: str) -> FuelCodeStatus:
        return (await self.repo.get_fuel_code_status(fuel_code_status))

    @service_handler
    async def update_fuel_code(self, fuel_code_id: int, fuel_code_data: FuelCodeCreateSchema):
        fuel_code = await self.get_fuel_code(fuel_code_id)
        if not fuel_code:
            raise ValueError("Fuel code not found")

        for field, value in fuel_code_data.model_dump(exclude={'feedstock_fuel_transport_modes', 'finished_fuel_transport_modes'}).items():
            setattr(fuel_code, field, value)

        fuel_code.feedstock_fuel_transport_modes.clear()
        if fuel_code_data.feedstock_fuel_transport_modes:
            for mode in fuel_code_data.feedstock_fuel_transport_modes:

                transport_mode = await self.repo.get_transport_mode(mode.transport_mode_id)

                feedstock_mode = FeedstockFuelTransportMode(
                    fuel_code_id=fuel_code.fuel_code_id,
                    transport_mode_id=transport_mode.transport_mode_id
                )

                fuel_code.feedstock_fuel_transport_modes.append(feedstock_mode)

        fuel_code.finished_fuel_transport_modes.clear()
        if fuel_code_data.finished_fuel_transport_modes:
            for mode in fuel_code_data.finished_fuel_transport_modes:

                transport_mode = await self.repo.get_transport_mode(mode.transport_mode_id)

                finished_mode = FinishedFuelTransportMode(
                    fuel_code_id=fuel_code.fuel_code_id,
                    transport_mode_id=transport_mode.transport_mode_id
                )

                fuel_code.finished_fuel_transport_modes.append(finished_mode)

        if fuel_code_data.status == 'Approved':
            fuel_code.fuel_status_id = (await self.get_fuel_code_status(fuel_code_data.status)).fuel_code_status_id
            fuel_code.approval_date = datetime.now()

        return await self.repo.update_fuel_code(fuel_code)

    @service_handler
    async def delete_fuel_code(self, fuel_code_id: int):
        return await self.repo.delete_fuel_code(fuel_code_id)

    async def get_energy_densities(self) -> List[EnergyDensitySchema]:
        """
        Gets the list of energy densities.
        """
        energy_densities = await self.repo.get_energy_densities()
        return [
            EnergyDensitySchema.model_validate(energy_density)
            for energy_density in energy_densities
        ]

    @service_handler
    async def get_energy_effectiveness_ratios(
        self,
    ) -> List[EnergyEffectivenessRatioSchema]:
        """
        Gets the list of energy effectiveness ratios.
        """
        energy_effectiveness_ratios = await self.repo.get_energy_effectiveness_ratios()
        return [
            EnergyEffectivenessRatioSchema.model_validate(value)
            for value in energy_effectiveness_ratios
        ]

    @service_handler
    async def get_use_of_a_carbon_intensities(
        self,
    ) -> List[AdditionalCarbonIntensitySchema]:
        """
        Gets the list of addtional use of a carbon intensity (UCI).
        """
        additional_carbon_intensities = (
            await self.repo.get_use_of_a_carbon_intensities()
        )
        return [
            AdditionalCarbonIntensitySchema.model_validate(value)
            for value in additional_carbon_intensities
        ]
