import math
from logging import getLogger
from typing import List
from fastapi import Depends
from datetime import datetime

from lcfs.web.api.notional_transfer.repo import NotionalTransferRepository
from lcfs.web.core.decorators import service_handler
from lcfs.db.models.compliance.NotionalTransfer import NotionalTransfer
from lcfs.web.api.notional_transfer.schema import (
    NotionalTransferCreateSchema,
    NotionalTransferSchema,
    NotionalTransfersSchema,
    NotionalTransferTableOptionsSchema,
    NotionalTransferFuelCategorySchema
)
from lcfs.web.api.fuel_code.repo import FuelCodeRepository

logger = getLogger("notional_transfer_services")

class NotionalTransferServices:
    def __init__(
        self, 
        repo: NotionalTransferRepository = Depends(NotionalTransferRepository),
        fuel_repo: FuelCodeRepository = Depends()
    ) -> None:
        self.repo = repo
        self.fuel_repo = fuel_repo

    async def convert_to_model(self, notional_transfer: NotionalTransferCreateSchema) -> NotionalTransfer:
        """
        Converts data from NotionalTransferCreateSchema to NotionalTransfer data model to store into the database.
        """
        fuel_category = await self.fuel_repo.get_fuel_category_by_name(notional_transfer.fuel_category)
        return NotionalTransfer(
            **notional_transfer.model_dump(exclude={"id", "fuel_category", "deleted"}),
            fuel_category_id=fuel_category.fuel_category_id
        )
    
    @service_handler
    async def get_table_options(self) -> NotionalTransferTableOptionsSchema:
        """
        Gets the list of table options related to notional transfers.
        """
        table_options = await self.repo.get_table_options()
        return {
            "fuel_categories": [NotionalTransferFuelCategorySchema.model_validate(category) for category in table_options["fuel_categories"]],
            "received_or_transferred": table_options["received_or_transferred"]
        }
    
    @service_handler
    async def get_notional_transfer(self, notional_transfer_id: int):
        return await self.repo.get_notional_transfer(notional_transfer_id)

    @service_handler
    async def get_notional_transfers(
        self, compliance_report_id: int
    ) -> NotionalTransfersSchema:
        """
        Gets the list of notional transfers for a specific compliance report.
        """
        notional_transfers = await self.repo.get_notional_transfers(compliance_report_id)
        return NotionalTransfersSchema(
            notional_transfers=[
                NotionalTransferSchema.model_validate(nt) for nt in notional_transfers
            ],
        )

    @service_handler
    async def update_notional_transfer(self, notional_transfer_data: NotionalTransferCreateSchema) -> NotionalTransferSchema:
        """Update an existing notional transfer"""

        existing_transfer = await self.get_notional_transfer(notional_transfer_data.notional_transfer_id)
        if not existing_transfer:
            raise ValueError("Notional transfer not found")
        
        existing_transfer.legal_name = notional_transfer_data.legal_name
        existing_transfer.address_for_service = notional_transfer_data.address_for_service
        existing_transfer.quantity = notional_transfer_data.quantity

        if existing_transfer.fuel_category.category is not notional_transfer_data.fuel_category:
            fuel_category = await self.fuel_repo.get_fuel_category_by_name(notional_transfer_data.fuel_category)
            existing_transfer.fuel_category = fuel_category

        updated_transfer = await self.repo.update_notional_transfer(existing_transfer)

        return NotionalTransferSchema(
            notional_transfer_id=updated_transfer.notional_transfer_id,
            compliance_report_id=updated_transfer.compliance_report_id,
            quantity=updated_transfer.quantity,
            legal_name=updated_transfer.legal_name,
            address_for_service=updated_transfer.address_for_service,
            fuel_category=updated_transfer.fuel_category.category,
            received_or_transferred=updated_transfer.received_or_transferred
        )

    @service_handler
    async def create_notional_transfer(self, notional_transfer_data: NotionalTransferCreateSchema) -> NotionalTransferSchema:
        """Create a new notional transfer"""
        notional_transfer = await self.convert_to_model(notional_transfer_data)
        created_transfer = await self.repo.create_notional_transfer(notional_transfer)
        fuel_category_value = created_transfer.fuel_category.category

        return NotionalTransferSchema(
            notional_transfer_id=created_transfer.notional_transfer_id,
            compliance_report_id=created_transfer.compliance_report_id,
            quantity=created_transfer.quantity,
            legal_name=created_transfer.legal_name,
            address_for_service=created_transfer.address_for_service,
            fuel_category=fuel_category_value,
            received_or_transferred=created_transfer.received_or_transferred
        )

    @service_handler
    async def delete_notional_transfer(self, notional_transfer_id: int) -> str:
        """Delete a notional transfer"""
        return await self.repo.delete_notional_transfer(notional_transfer_id)
