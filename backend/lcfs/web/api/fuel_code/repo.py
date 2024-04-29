from logging import getLogger
from typing import List

from fastapi import Depends
from lcfs.db.dependencies import get_async_db_session
from fastapi_cache.decorator import cache

from sqlalchemy import select, update, func, desc, asc, and_, case, or_
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.models.FuelType import FuelType
from lcfs.db.models.TransportMode import TransportMode
from lcfs.db.models.FuelCodePrefix import FuelCodePrefix
from lcfs.db.models.FeedstockFuelTransportMode import FeedstockFuelTransportMode
from lcfs.db.models.FinishedFuelTransportMode import FinishedFuelTransportMode
from lcfs.web.api.base import PaginationRequestSchema, fuel_code_list_cache_key_builder
from lcfs.web.api.fuel_code.schema import FuelCodeSchema
from lcfs.db.models.FuelCode import FuelCode
from lcfs.web.core.decorators import repo_handler
from sqlalchemy.orm import joinedload

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
    async def get_fuel_code_prefixes(self) -> List[FuelCodePrefix]:
        """Get all fuel code prefix options"""
        return (await self.db.execute(select(FuelCodePrefix))).scalars().all()

    @repo_handler
    # @cache(
    #     expire=3600 * 24,
    #     key_builder=fuel_code_list_cache_key_builder,
    #     namespace="users",
    # )  # Cache for 24 hours, already handled to clear cache if any new users are added or existing users are updated.
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
        # setup pagination
        offset = 0 if (pagination.page < 1) else (pagination.page - 1) * pagination.size
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
        result = await self.db.execute(query.offset(offset).limit(limit))
        fuel_codes = result.unique().scalars().all()
        return fuel_codes, total_count
