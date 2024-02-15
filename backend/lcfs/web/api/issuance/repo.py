from logging import getLogger
from typing import List

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from lcfs.db.dependencies import get_async_db_session
from lcfs.web.core.decorators import repo_handler

from lcfs.db.models.Issuance import Issuance

logger = getLogger("issuance_repo")

class IssuanceRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_all_issuances(self) -> List[Issuance]:
        """Queries the database for all issuance records."""
        result = await self.db.execute(select(Issuance))
        return result.scalars().all()

    @repo_handler
    async def get_issuance_by_id(self, issuance_id: int) -> Issuance:
        '''Queries the database for an issuance by its ID and returns the ORM model.'''
        return await self.db.scalar(select(Issuance).where(Issuance.issuance_id == issuance_id))

    @repo_handler
    async def create_issuance(self, issuance: Issuance) -> Issuance:
        '''Save an issuance and its associated comment in the database.'''
        self.db.add(issuance)
        await self.db.flush()
        return issuance

    @repo_handler
    async def update_issuance(self, issuance: Issuance) -> Issuance:
        '''Updates an existing issuance record in the database.'''
        # This method assumes that the issuance object has already been modified
        # in the service layer, so we just need to flush the changes.
        await self.db.flush()
        return issuance

    @repo_handler
    async def get_issuances_paginated(self, page: int, size: int) -> List[Issuance]:
        offset = (page - 1) * size
        query = select(Issuance).order_by(Issuance.create_date.desc()).offset(offset).limit(size)
        results = await self.db.execute(query)
        issuances = results.scalars().all()
        return issuances