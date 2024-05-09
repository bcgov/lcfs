from logging import getLogger
from typing import List

from fastapi import Depends
from lcfs.db.dependencies import get_async_db_session

from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from lcfs.db.models.FuelType import FuelType
from lcfs.db.models.TransportMode import TransportMode
from lcfs.db.models.FuelCodePrefix import FuelCodePrefix
from lcfs.db.models.FeedstockFuelTransportMode import FeedstockFuelTransportMode
from lcfs.db.models.FinishedFuelTransportMode import FinishedFuelTransportMode
from lcfs.db.models.FuelCodeStatus import FuelCodeStatus
from lcfs.db.models.FuelCode import FuelCode
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.fuel_code.schema import FuelCodeSchema
from lcfs.web.core.decorators import repo_handler

logger = getLogger("fuel_code_repo")


class FuelCodeRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_fuel_types(self) -> List[FuelType]:
        """Get all fuel type options"""
        return (await self.db.execute(select(FuelType))).scalars().all()

    @repo_handler
    async def get_transport_modes(self) -> List[TransportMode]:
        """Get all transport mode options"""
        return (await self.db.execute(select(TransportMode))).scalars().all()

    @repo_handler
    async def get_transport_mode(self, transport_mode_id: int) -> TransportMode:
        return await self.db.scalar(select(TransportMode).where(TransportMode.transport_mode_id == transport_mode_id))

    @repo_handler
    async def get_fuel_code_prefixes(self) -> List[FuelCodePrefix]:
        """Get all fuel code prefix options"""
        return (await self.db.execute(select(FuelCodePrefix))).scalars().all()

    @repo_handler
    async def get_fuel_status_by_status(self, status: str) -> FuelCodeStatus:
        """Get fuel status by name"""
        return (
            await self.db.execute(select(FuelCodeStatus).filter_by(status=status))
        ).scalar()

    @repo_handler
    async def get_fuel_codes_paginated(
        self, pagination: PaginationRequestSchema
    ) -> List[FuelCodeSchema]:
        """
        Queries fuel codes from the database with optional filters. Supports pagination and sorting.

        Args:
            pagination (dict): Pagination and sorting parameters.

        Returns:
            List[FuelCodeSchema]: A list of fuel codes matching the query.
        """
        conditions = []
        # TODO: Filtering and Sorting logic needs to be added.
        # setup pagination
        offset = 0 if (pagination.page < 1) else (
            pagination.page - 1) * pagination.size
        limit = pagination.size
        # Construct the select query with options for eager loading
        query = select(FuelCode).options(
            joinedload(FuelCode.fuel_code_status),
            joinedload(FuelCode.fuel_code_prefix),
            joinedload(FuelCode.fuel_code_type),
            joinedload(FuelCode.feedstock_fuel_transport_modes).joinedload(
                FeedstockFuelTransportMode.feedstock_fuel_transport_mode
            ),
            joinedload(FuelCode.finished_fuel_transport_modes).joinedload(
                FinishedFuelTransportMode.finished_fuel_transport_mode
            ),
        )
        # Execute the count query to get the total count
        count_query = query.with_only_columns(func.count()).order_by(None)
        total_count = (await self.db.execute(count_query)).scalar()

        # Execute the main query to retrieve all fuel codes
        result = await self.db.execute(
            query.offset(offset).limit(limit).order_by(
                FuelCode.create_date.desc())
        )
        fuel_codes = result.unique().scalars().all()
        return fuel_codes, total_count

    @repo_handler
    async def save_fuel_codes(self, fuel_codes: List[FuelCode]) -> str:
        """
        Saves fuel codes to the database.

        Args:
            fuel_codes (List[FuelCodeSchema]): A list of fuel codes to be saved.
        """
        self.db.add_all(fuel_codes)
        await self.db.flush()

        return "fuel codes added successfully"

    @repo_handler
    async def get_fuel_code(self, fuel_code_id: int) -> FuelCode:
        return (await self.db.scalar(select(FuelCode).options(
            joinedload(FuelCode.feedstock_fuel_transport_modes).joinedload(
                FeedstockFuelTransportMode.feedstock_fuel_transport_mode
            ),
            joinedload(FuelCode.finished_fuel_transport_modes).joinedload(
                FinishedFuelTransportMode.finished_fuel_transport_mode
            ),
        ).where(FuelCode.fuel_code_id == fuel_code_id)))

    @repo_handler
    async def get_fuel_code_status(self, fuel_code_status: str) -> FuelCodeStatus:
        return await self.db.scalar(select(FuelCodeStatus).where(FuelCodeStatus.status == fuel_code_status))

    @repo_handler
    async def update_fuel_code(self, fuel_code: FuelCode) -> FuelCodeSchema:

        await self.db.flush()
        await self.db.refresh(
            fuel_code
        )

        return FuelCodeSchema.model_validate(fuel_code)

    @repo_handler
    async def delete_fuel_code(self, fuel_code_id: int):

        await self.db.execute(update(FuelCode).where(FuelCode.fuel_code_id == fuel_code_id).values(fuel_status_id=3))
