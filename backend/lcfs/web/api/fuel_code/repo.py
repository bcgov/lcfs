from logging import getLogger
from typing import List

from fastapi import Depends
from lcfs.db.dependencies import get_async_db_session

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.web.api.repo import BaseRepository
from lcfs.db.models.FuelType import FuelType
from lcfs.db.models.TransportMode import TransportMode
from lcfs.db.models.FuelCodePrefix import FuelCodePrefix

from lcfs.web.core.decorators import repo_handler

logger = getLogger("fuel_code_repo")


class FuelCodeRepository(BaseRepository):
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        super().__init__(db)

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
