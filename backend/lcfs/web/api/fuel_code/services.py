from logging import getLogger
import math
from typing import List
from fastapi import Depends

from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.core.decorators import service_handler
from lcfs.web.api.base import PaginationRequestSchema, PaginationResponseSchema
from lcfs.db.models.FeedstockFuelTransportMode import FeedstockFuelTransportMode
from lcfs.db.models.FinishedFuelTransportMode import FinishedFuelTransportMode
from lcfs.db.models.FuelCodePrefix import FuelCodePrefix
from lcfs.db.models.FuelType import FuelType
from lcfs.db.models.FuelCodeStatus import FuelCodeStatus, FuelCodeStatusEnum
from lcfs.db.models.FuelCode import FuelCode
from lcfs.db.models.TransportMode import TransportMode
from lcfs.web.api.fuel_code.schema import (
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
