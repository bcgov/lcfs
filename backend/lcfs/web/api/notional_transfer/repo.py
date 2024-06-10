from logging import getLogger
from typing import List

from fastapi import Depends
from lcfs.db.dependencies import get_async_db_session

from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.models.compliance.NotionalTransfer import NotionalTransfer
from lcfs.db.models.fuel.FuelCategory import FuelCategory
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.notional_transfer.schema import NotionalTransferSchema
from lcfs.web.core.decorators import repo_handler

logger = getLogger("notional_transfer_repo")


class NotionalTransferRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session), fuel_repo: FuelCodeRepository = Depends()):
        self.db = db
        self.fuel_code_repo = fuel_repo

    @repo_handler
    async def get_table_options(self) -> List[str]:
        """Get all table options"""
        fuel_categories = await self.fuel_code_repo.get_fuel_categories()
        return fuel_categories

    @repo_handler
    async def get_notional_transfers_paginated(
        self, pagination: PaginationRequestSchema, compliance_report_id: int
    ) -> List[NotionalTransferSchema]:
        """
        Queries notional transfers from the database for a specific compliance report with optional filters. Supports pagination and sorting.

        Args:
            pagination (dict): Pagination and sorting parameters.
            compliance_report_id (int): ID of the compliance report.

        Returns:
            List[NotionalTransferSchema]: A list of notional transfers matching the query.
        """
        offset = 0 if (pagination.page < 1) else (
            pagination.page - 1) * pagination.size
        limit = pagination.size

        query = select(NotionalTransfer).where(NotionalTransfer.compliance_report_id == compliance_report_id).offset(offset).limit(limit)
        count_query = query.with_only_columns(func.count()).order_by(None)
        total_count = (await self.db.execute(count_query)).scalar()

        result = await self.db.execute(query)
        notional_transfers = result.unique().scalars().all()
        return notional_transfers, total_count


    @repo_handler
    async def save_notional_transfers(self, notional_transfers: List[NotionalTransfer]) -> str:
        """
        Saves notional transfers to the database.

        Args:
            notional_transfers (List[NotionalTransfer]): A list of notional transfers to be saved.
        """
        self.db.add_all(notional_transfers)
        await self.db.flush()

        return "Notional transfers added successfully"

    @repo_handler
    async def get_notional_transfer(self, notional_transfer_id: int) -> NotionalTransfer:
        return await self.db.scalar(select(NotionalTransfer).where(NotionalTransfer.notional_transfer_id == notional_transfer_id))

    @repo_handler
    async def update_notional_transfer(self, notional_transfer: NotionalTransfer) -> NotionalTransferSchema:
        await self.db.flush()
        await self.db.refresh(notional_transfer)
        return NotionalTransferSchema.model_validate(notional_transfer)

    @repo_handler
    async def delete_notional_transfer(self, notional_transfer_id: int):
        await self.db.execute(update(NotionalTransfer).where(NotionalTransfer.notional_transfer_id == notional_transfer_id).values(deleted=True))
