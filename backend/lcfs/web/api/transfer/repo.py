from logging import getLogger
from typing import List

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from datetime import datetime

from lcfs.db.dependencies import get_async_db_session
from lcfs.web.core.decorators import repo_handler
from lcfs.web.api.transfer.schema import TransferSchema

from lcfs.db.models.transfer.Transfer import Transfer
from lcfs.db.models.transfer.TransferStatus import TransferStatus, TransferStatusEnum
from lcfs.db.models.transfer.TransferCategory import (
    TransferCategory,
    TransferCategoryEnum,
)
from lcfs.db.models.transfer.TransferHistory import TransferHistory

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
            selectinload(Transfer.current_status),
            selectinload(Transfer.transfer_category),
            selectinload(Transfer.transfer_history).selectinload(
                TransferHistory.user_profile
            ),
            selectinload(Transfer.transfer_history).selectinload(
                TransferHistory.transfer_status
            ),
        )
        result = await self.db.execute(query)
        transfers = result.scalars().all()
        return transfers

    # @repo_handler
    # async def get_transfers_paginated(self, page: int, size: int) -> List[Transfer]:
    #     """
    #     Fetches a paginated list of Transfer records from the database, ordered by their creation date.
    #     """
    #     offset = (page - 1) * size
    #     query = (
    #         select(Transfer)
    #         .order_by(Transfer.create_date.desc())
    #         .offset(offset)
    #         .limit(size)
    #     )
    #     results = await self.db.execute(query)
    #     transfers = results.scalars().all()
    #     return transfers

    @repo_handler
    async def get_transfer_by_id(self, transfer_id: int) -> Transfer:
        """
        Queries the database for a transfer by its ID and returns the ORM model.
        Eagerly loads related entities to prevent lazy loading issues.
        """
        query = (
            select(Transfer)
            .options(
                selectinload(Transfer.from_organization),
                selectinload(Transfer.to_organization),
                selectinload(Transfer.from_transaction),
                selectinload(Transfer.to_transaction),
                selectinload(Transfer.current_status),
                selectinload(Transfer.transfer_category),
                selectinload(Transfer.transfer_history).selectinload(
                    TransferHistory.user_profile
                ),
                selectinload(Transfer.transfer_history).selectinload(
                    TransferHistory.transfer_status
                ),
            )
            .where(Transfer.transfer_id == transfer_id)
        )

        result = await self.db.execute(query)
        transfer = result.scalars().first()
        return transfer

    @repo_handler
    async def create_transfer(self, transfer: Transfer) -> TransferSchema:
        """Save a transfer and its associated comment in the database."""
        self.db.add(transfer)
        await self.db.flush()  # Ensures IDs and relationships are populated
        await self.db.refresh(
            transfer,
            [
                "from_organization",
                "to_organization",
                "current_status",
                "transfer_category",
                "transfer_history",
            ],
        )  # Ensures that all specified relations are up-to-date

        # Convert to schema
        transfer_schema = TransferSchema.from_orm(transfer)
        return transfer_schema

    # @repo_handler
    # async def get_transfer_status_by_id(
    #     self, transfer_status_id: int
    # ) -> TransferStatus:
    #     """Fetch a single transfer status by transfer status id from the database"""
    #     return await self.db.scalar(
    #         select(TransferStatus).where(
    #             TransferStatus.transfer_status_id == transfer_status_id
    #         )
    #     )

    # @repo_handler
    # async def get_transfer_category(self, transfer_category_id: int) -> TransferStatus:
    #     """Fetch a single category by category id from the database"""
    #     return await self.db.scalar(
    #         select(TransferCategory).where(
    #             TransferCategory.transfer_category_id == transfer_category_id
    #         )
    #     )

    @repo_handler
    async def get_transfer_status_by_name(
        self, transfer_status_name: str
    ) -> TransferStatus:
        """Fetch a single transfer status by transfer status name from the database"""
        return await self.db.scalar(
            select(TransferStatus).where(
                TransferStatus.status
                == getattr(TransferStatusEnum, transfer_status_name)
            )
        )

    @repo_handler
    async def get_transfer_category_by_name(
        self, transfer_category_name: str
    ) -> TransferCategory:
        return await self.db.scalar(
            select(TransferCategory).where(
                TransferCategory.category
                == getattr(TransferCategoryEnum, transfer_category_name)
            )
        )

    @repo_handler
    async def update_transfer(self, transfer: Transfer) -> TransferSchema:
        """Persists the changes made to the Transfer object to the database."""
        await self.db.flush()
        await self.db.refresh(
            transfer,
            [
                "from_organization",
                "to_organization",
                "current_status",
                "transfer_category",
                "transfer_history",
            ],
        )
        return TransferSchema.model_validate(transfer)

    @repo_handler
    async def add_transfer_history(
        self, transfer_id: int, transfer_status_id: int, user_profile_id: int
    ) -> TransferHistory:
        """
        Adds a new record to the transfer history in the database.

        Args:
            transfer_id (int): The ID of the transfer to which this history record relates.
            transfer_status_id (int): The status ID that describes the current state of the transfer.

        Returns:
            TransferHistory: The newly created transfer history record.
        """
        new_history_record = TransferHistory(
            transfer_id=transfer_id,
            transfer_status_id=transfer_status_id,
            user_profile_id=user_profile_id,
        )
        self.db.add(new_history_record)
        await self.db.flush()
        return new_history_record

    @repo_handler
    async def update_transfer_history(
        self, transfer_id: int, transfer_status_id: int, user_profile_id: int
    ) -> TransferHistory:
        """
        Updates a transfer history record in the database.

        Args:
            transfer_id (int): The ID of the transfer to which this history record relates.
            transfer_status_id (int): The status ID that describes the current state of the transfer.

        Returns:
            TransferHistory: updated transfer history record.
        """
        existing_history = await self.db.scalar(
            select(TransferHistory).where(
                and_(
                    TransferHistory.transfer_id == transfer_id,
                    TransferHistory.transfer_status_id == transfer_status_id,
                )
            )
        )
        existing_history.create_date = datetime.now()
        existing_history.update_date = datetime.now()
        existing_history.user_profile_id = user_profile_id
        self.db.add(existing_history)
        await self.db.flush()
        return existing_history

    @repo_handler
    async def refresh_transfer(self, transfer: Transfer) -> Transfer:
        """
        Commits and refreshes a transfer object in db session

        """
        await self.db.refresh(transfer)
        return transfer
