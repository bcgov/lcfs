from logging import getLogger
from typing import List

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from lcfs.db.dependencies import get_async_db_session
from lcfs.web.core.decorators import repo_handler

from lcfs.db.models.Transfer import Transfer
from lcfs.db.models.TransferStatus import TransferStatus
from lcfs.db.models.Category import Category
from lcfs.db.models.Comment import Comment

logger = getLogger("transfer_repo")


class TransferRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_all_transfers(self) -> List[Transfer]:
        """Queries the database for all transfer records."""
        query = select(Transfer).options(
            selectinload(Transfer.from_organization),
            selectinload(Transfer.to_organization),
            selectinload(Transfer.transfer_status),
            selectinload(Transfer.transfer_category),
            selectinload(Transfer.comments)
        )
        result = await self.db.execute(query)
        transfers = result.scalars().all()
        return transfers

    @repo_handler
    async def get_transfers_paginated(self, page: int, size: int) -> List[Transfer]:
        """
        Fetches a paginated list of Transfer records from the database, ordered by their creation date.
        """
        offset = (page - 1) * size
        query = select(Transfer).order_by(
            Transfer.create_date.desc()).offset(offset).limit(size)
        results = await self.db.execute(query)
        transfers = results.scalars().all()
        return transfers

    @repo_handler
    async def get_transfer_by_id(self, transfer_id: int) -> Transfer:
        """
        Queries the database for a transfer by its ID and returns the ORM model.
        Eagerly loads related entities to prevent lazy loading issues.
        """
        query = select(Transfer).options(
            selectinload(Transfer.from_organization),
            selectinload(Transfer.to_organization),
            selectinload(Transfer.transfer_status),
            selectinload(Transfer.transfer_category),
            selectinload(Transfer.comments)
        ).where(Transfer.transfer_id == transfer_id)

        result = await self.db.execute(query)
        transfer = result.scalars().first()
        return transfer

    @repo_handler
    async def create_transfer(self, transfer: Transfer) -> Transfer:
        '''Save a transfer and its associated comment in the database.'''
        self.db.add(transfer)
        await self.db.flush()  # This saves both the transfer and the comment
        # No need to explicitly add and save the comment if it's properly associated with the transfer
        return transfer

    @repo_handler
    async def get_transfer_status(self, transfer_status_id: int) -> TransferStatus:
        '''Fetch a single transfer status by transfer status id from the database'''
        return await self.db.scalar(
            select(TransferStatus).where(
                TransferStatus.transfer_status_id == transfer_status_id)
        )

    @repo_handler
    async def get_transfer_category(self, transfer_category_id: int) -> TransferStatus:
        '''Fetch a single category by category id from the database'''
        return await self.db.scalar(
            select(Category).where(
                Category.category_id == transfer_category_id)
        )

    @repo_handler
    async def update_transfer(self, transfer: Transfer) -> Transfer:
        """Persists the changes made to the Transfer object to the database."""
        # Assuming the transfer object has been modified in the service,
        # we just need to commit those changes.
        try:
            await self.db.commit()
            # Refresh the instance with updated data from the DB.
            await self.db.refresh(transfer)
            return transfer
        except Exception as e:
            await self.db.rollback()  # Rollback in case of error
            raise e
