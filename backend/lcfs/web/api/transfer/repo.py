import structlog
from typing import List, Optional

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from datetime import datetime

from lcfs.db.dependencies import get_async_db_session
from lcfs.web.core.decorators import repo_handler
from lcfs.web.api.transfer.schema import CreateTransferHistorySchema, TransferSchema

from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.db.models.transfer.Transfer import Transfer
from lcfs.db.models.transfer.TransferStatus import TransferStatus
from lcfs.db.models.transfer.TransferCategory import (
    TransferCategory,
    TransferCategoryEnum,
)
from lcfs.db.models.transfer.TransferHistory import TransferHistory
from lcfs.db.models.transfer.TransferComment import (
    TransferComment,
    TransferCommentSourceEnum,
)

logger = structlog.get_logger(__name__)


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
            selectinload(Transfer.transfer_comments),
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
        Orders the transfer history by create_date.
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
                selectinload(Transfer.transfer_comments),
                selectinload(Transfer.transfer_comments).selectinload(
                    TransferComment.user_profile
                ),
                selectinload(Transfer.transfer_comments)
                .selectinload(TransferComment.user_profile)
                .selectinload(UserProfile.organization),
            )
            .where(Transfer.transfer_id == transfer_id)
        )

        result = await self.db.execute(query)
        transfer = result.scalars().first()

        # Ensure transfer_history is ordered by create_date
        if transfer and transfer.transfer_history:
            transfer.transfer_history.sort(key=lambda history: history.create_date)

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
                "transfer_comments",
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
            select(TransferStatus).where(TransferStatus.status == transfer_status_name)
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
                "from_transaction",
                "to_transaction",
                "current_status",
                "transfer_category",
                "transfer_history",
                "transfer_comments",
            ],
        )
        return TransferSchema.model_validate(transfer)

    @repo_handler
    async def add_transfer_history(
        self, transfer_history: CreateTransferHistorySchema
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
            transfer_id=transfer_history.transfer_id,
            transfer_status_id=transfer_history.transfer_status_id,
            user_profile_id=transfer_history.user_profile_id,
            display_name=transfer_history.display_name,
        )
        self.db.add(new_history_record)
        await self.db.flush()
        return new_history_record

    @repo_handler
    async def upsert_transfer_comment(
        self, transfer_id: int, comment: str, comment_source: TransferCommentSourceEnum
    ) -> Optional[TransferComment]:
        """
        Finds or creates a TransferComment row for the given `transfer_id` and `comment_source`.

        - If 'comment' is blank or None, do nothing (skip).
        - If there's an existing row, update its 'comment'.
        - If no existing row, create a new one.
        - Returns the updated/created TransferComment, or None if skipped.
        """
        # If the comment is blank or None, skip entirely
        if not comment or not comment.strip():
            return None

        # Try to find existing
        stmt = select(TransferComment).where(
            TransferComment.transfer_id == transfer_id,
            TransferComment.comment_source == comment_source,
        )
        existing = await self.db.scalar(stmt)

        # If existing, update
        if existing:
            existing.comment = comment.strip()
            existing.update_date = datetime.now()
            self.db.add(existing)
            await self.db.flush()
            return existing

        # Otherwise create new
        new_comment = TransferComment(
            transfer_id=transfer_id,
            comment=comment.strip(),
            comment_source=comment_source,
        )
        self.db.add(new_comment)
        await self.db.flush()
        return new_comment

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
