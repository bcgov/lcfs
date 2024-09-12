from logging import getLogger
from typing import List

from fastapi import Depends
from lcfs.db.dependencies import get_async_db_session

from sqlalchemy import select, delete, func
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.models.compliance.NotionalTransfer import (
    NotionalTransfer,
    ReceivedOrTransferredEnum,
)
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.api.notional_transfer.schema import NotionalTransferSchema
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.core.decorators import repo_handler

logger = getLogger("notional_transfer_repo")


class NotionalTransferRepository:
    def __init__(
        self,
        db: AsyncSession = Depends(get_async_db_session),
        fuel_repo: FuelCodeRepository = Depends(),
    ):
        self.db = db
        self.fuel_code_repo = fuel_repo

    @repo_handler
    async def get_table_options(self) -> dict:
        """Get all table options"""
        fuel_categories = await self.fuel_code_repo.get_fuel_categories()
        received_or_transferred = [e.value for e in ReceivedOrTransferredEnum]
        return {
            "fuel_categories": fuel_categories,
            "received_or_transferred": received_or_transferred,
        }

    @repo_handler
    async def get_notional_transfers(
        self, compliance_report_id: int
    ) -> List[NotionalTransferSchema]:
        """
        Queries notional transfers from the database for a specific compliance report.
        """
        query = (
            select(NotionalTransfer)
            .options(joinedload(NotionalTransfer.fuel_category))
            .where(NotionalTransfer.compliance_report_id == compliance_report_id)
        )
        result = await self.db.execute(query)
        notional_transfers = result.unique().scalars().all()

        return [
            NotionalTransferSchema(
                notional_transfer_id=nt.notional_transfer_id,
                compliance_report_id=nt.compliance_report_id,
                quantity=nt.quantity,
                legal_name=nt.legal_name,
                address_for_service=nt.address_for_service,
                fuel_category=nt.fuel_category.category,
                received_or_transferred=nt.received_or_transferred,
            )
            for nt in notional_transfers
        ]

    async def get_notional_transfers_paginated(
        self, pagination: PaginationRequestSchema, compliance_report_id: int
    ) -> List[NotionalTransferSchema]:
        conditions = [NotionalTransfer.compliance_report_id == compliance_report_id]
        offset = 0 if pagination.page < 1 else (pagination.page - 1) * pagination.size
        limit = pagination.size

        query = (
            select(NotionalTransfer)
            .options(joinedload(NotionalTransfer.fuel_category))
            .where(*conditions)
        )

        count_query = query.with_only_columns(func.count()).order_by(None)
        total_count = (await self.db.execute(count_query)).scalar()

        result = await self.db.execute(
            query.offset(offset)
            .limit(limit)
            .order_by(NotionalTransfer.create_date.desc())
        )
        notional_transfers = result.unique().scalars().all()

        return notional_transfers, total_count

    @repo_handler
    async def save_notional_transfers(
        self, notional_transfers: List[NotionalTransfer]
    ) -> str:
        """
        Saves or updates notional transfers in the database.
        """
        for transfer in notional_transfers:
            if (
                transfer.notional_transfer_id
            ):  # If id exists, update the existing transfer
                existing_transfer = await self.db.get(
                    NotionalTransfer, transfer.notional_transfer_id
                )
                if existing_transfer:
                    existing_transfer.compliance_report_id = (
                        transfer.compliance_report_id
                    )
                    existing_transfer.quantity = transfer.quantity
                    existing_transfer.legal_name = transfer.legal_name
                    existing_transfer.address_for_service = transfer.address_for_service
                    existing_transfer.fuel_category_id = transfer.fuel_category_id
                    existing_transfer.received_or_transferred = (
                        transfer.received_or_transferred
                    )
                else:
                    self.db.add(transfer)
            else:  # If no id, add as new
                self.db.add(transfer)

        await self.db.flush()
        return "Notional transfers saved or updated successfully"

    @repo_handler
    async def get_notional_transfer(
        self, notional_transfer_id: int
    ) -> NotionalTransfer:
        """
        Get a specific notional transfer by id.
        """
        return await self.db.scalar(
            select(NotionalTransfer)
            .options(joinedload(NotionalTransfer.fuel_category))
            .where(NotionalTransfer.notional_transfer_id == notional_transfer_id)
        )

    @repo_handler
    async def update_notional_transfer(
        self, notional_transfer: NotionalTransfer
    ) -> NotionalTransfer:
        """
        Update an existing notional transfer in the database.
        """
        updated_notional_transfer = await self.db.merge(notional_transfer)
        await self.db.flush()
        await self.db.refresh(updated_notional_transfer, ["fuel_category"])
        return updated_notional_transfer

    @repo_handler
    async def create_notional_transfer(
        self, notional_transfer: NotionalTransfer
    ) -> NotionalTransfer:
        """
        Create a new notional transfer in the database.
        """
        self.db.add(notional_transfer)
        await self.db.flush()
        await self.db.refresh(notional_transfer, ["fuel_category"])
        return notional_transfer

    @repo_handler
    async def delete_notional_transfer(self, notional_transfer_id: int):
        """Delete a notional transfer from the database"""
        await self.db.execute(
            delete(NotionalTransfer).where(
                NotionalTransfer.notional_transfer_id == notional_transfer_id
            )
        )
        await self.db.flush()
