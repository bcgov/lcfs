import math
from logging import getLogger
from typing import List
from fastapi import Depends
from datetime import datetime

from lcfs.web.api.notional_transfer.repo import NotionalTransferRepository
from lcfs.web.core.decorators import service_handler
from lcfs.web.api.base import PaginationRequestSchema, PaginationResponseSchema
from lcfs.db.models.compliance.NotionalTransfer import NotionalTransfer
from lcfs.web.api.notional_transfer.schema import (
    NotionalTransferCreateSchema,
    NotionalTransferSchema,
    NotionalTransfersSchema,
    NotionalTransferTableOptionsSchema,
    NotionalTransferFuelCategorySchema
)

logger = getLogger("notional_transfer_services")


class NotionalTransferServices:
    def __init__(self, repo: NotionalTransferRepository = Depends(NotionalTransferRepository)) -> None:
        self.repo = repo

    @service_handler
    async def get_table_options(self) -> NotionalTransferTableOptionsSchema:
        """
        Gets the list of table options related to notional transfers.
        """
        fuel_categories = await self.repo.get_table_options()
        return {"fuel_categories": [NotionalTransferFuelCategorySchema.model_validate(category) for category in fuel_categories]}

    @service_handler
    async def get_notional_transfers(
        self, pagination: PaginationRequestSchema, compliance_report_id: int
    ) -> NotionalTransfersSchema:
        """
        Gets the list of notional transfers for a specific compliance report.
        """
        notional_transfers, total_count = await self.repo.get_notional_transfers_paginated(pagination, compliance_report_id)

        return NotionalTransfersSchema(
            pagination=PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=math.ceil(total_count / pagination.size),
            ),
            notional_transfers=[
                NotionalTransferSchema.model_validate(notional_transfer) for notional_transfer in notional_transfers
            ],
        )

    async def convert_to_model(self, notional_transfer: NotionalTransferCreateSchema) -> NotionalTransfer:
        """
        Converts data from NotionalTransferCreateSchema to NotionalTransfer data model to store into the database.
        """
        return NotionalTransfer(**notional_transfer.model_dump())

    @service_handler
    async def save_notional_transfers(self, notional_transfers: List[NotionalTransferCreateSchema]) -> str:
        """
        Saves the list of notional transfers.
        """
        logger.info(f"Saving {len(notional_transfers)} notional transfer(s)")
        notional_transfer_models = []
        for notional_transfer in notional_transfers:
            notional_transfer_models.append(await self.convert_to_model(notional_transfer))
        if len(notional_transfer_models) > 0:
            return await self.repo.save_notional_transfers(notional_transfer_models)

    @service_handler
    async def get_notional_transfer(self, notional_transfer_id: int):
        return await self.repo.get_notional_transfer(notional_transfer_id)

    @service_handler
    async def update_notional_transfer(self, notional_transfer_id: int, notional_transfer_data: NotionalTransferCreateSchema):
        notional_transfer = await self.get_notional_transfer(notional_transfer_id)
        if not notional_transfer:
            raise ValueError("Notional transfer not found")

        for field, value in notional_transfer_data.model_dump().items():
            setattr(notional_transfer, field, value)

        return await self.repo.update_notional_transfer(notional_transfer)

    @service_handler
    async def delete_notional_transfer(self, notional_transfer_id: int):
        return await self.repo.delete_notional_transfer(notional_transfer_id)
