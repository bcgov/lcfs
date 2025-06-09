import math
import structlog
import uuid
from fastapi import Depends, HTTPException, status, Request
from typing import Optional

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models.compliance.NotionalTransfer import NotionalTransfer
from lcfs.web.api.base import PaginationRequestSchema, PaginationResponseSchema
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.api.notional_transfer.repo import NotionalTransferRepository
from lcfs.web.api.notional_transfer.schema import (
    NotionalTransferCreateSchema,
    NotionalTransferSchema,
    NotionalTransfersSchema,
    NotionalTransferTableOptionsSchema,
    NotionalTransferFuelCategorySchema,
    NotionalTransfersAllSchema,
    DeleteNotionalTransferResponseSchema,
)
from lcfs.web.core.decorators import service_handler

logger = structlog.get_logger(__name__)

# Constants defining which fields to exclude during model operations
NOTIONAL_TRANSFER_EXCLUDE_FIELDS = {
    "id",
    "notional_transfer_id",
    "deleted",
    "group_uuid",
    "user_type",
    "version",
    "action_type",
    "is_new_supplemental_entry",
}


class NotionalTransferServices:
    def __init__(
        self,
        repo: NotionalTransferRepository = Depends(NotionalTransferRepository),
        fuel_repo: FuelCodeRepository = Depends(),
        compliance_report_repo: ComplianceReportRepository = Depends(),
    ) -> None:
        self.repo = repo
        self.fuel_repo = fuel_repo
        self.compliance_report_repo = compliance_report_repo

    async def convert_to_model(
        self, notional_transfer_data: NotionalTransferCreateSchema
    ) -> NotionalTransfer:
        """
        Converts data from NotionalTransferCreateSchema to NotionalTransfer data model to store into the database.
        """
        fuel_category = await self.fuel_repo.get_fuel_category_by(
            category=notional_transfer_data.fuel_category
        )
        return NotionalTransfer(
            **notional_transfer_data.model_dump(
                exclude=NOTIONAL_TRANSFER_EXCLUDE_FIELDS.union({"fuel_category"})
            ),
            fuel_category_id=fuel_category.fuel_category_id,
        )

    def model_to_schema(self, model: NotionalTransfer) -> NotionalTransferSchema:
        """
        Converts data from NotionalTransfer model to NotionalTransferSchema.
        """
        return NotionalTransferSchema(
            notional_transfer_id=model.notional_transfer_id,
            compliance_report_id=model.compliance_report_id,
            quantity=model.quantity,
            q1_quantity=model.q1_quantity,
            q2_quantity=model.q2_quantity,
            q3_quantity=model.q3_quantity,
            q4_quantity=model.q4_quantity,
            legal_name=model.legal_name,
            address_for_service=model.address_for_service,
            fuel_category=model.fuel_category.category,
            received_or_transferred=model.received_or_transferred,
            group_uuid=model.group_uuid,
            version=model.version,
            action_type=model.action_type,
        )

    @service_handler
    async def get_table_options(self) -> NotionalTransferTableOptionsSchema:
        """
        Gets the list of table options related to notional transfers.
        """
        table_options = await self.repo.get_table_options()
        return NotionalTransferTableOptionsSchema(
            fuel_categories=[
                NotionalTransferFuelCategorySchema.model_validate(category)
                for category in table_options["fuel_categories"]
            ],
            received_or_transferred=table_options["received_or_transferred"],
        )

    @service_handler
    async def get_notional_transfer(self, notional_transfer_id: int):
        notional_transfer = await self.repo.get_notional_transfer(notional_transfer_id)
        if not notional_transfer:
            return None
        return self.model_to_schema(notional_transfer)

    @service_handler
    async def get_notional_transfers(
        self,
        compliance_report_id: int,
        changelog: bool = False,
    ) -> NotionalTransfersAllSchema:
        """
        Gets the list of notional transfers for a specific compliance report.
        """
        notional_transfers = await self.repo.get_notional_transfers(
            compliance_report_id, changelog
        )
        return NotionalTransfersAllSchema(
            notional_transfers=[
                NotionalTransferSchema.model_validate(nt) for nt in notional_transfers
            ]
        )

    @service_handler
    async def get_notional_transfers_paginated(
        self,
        pagination: PaginationRequestSchema,
        compliance_report_id: int,
    ) -> NotionalTransfersSchema:
        notional_transfers, total_count = (
            await self.repo.get_notional_transfers_paginated(
                pagination, compliance_report_id
            )
        )
        return NotionalTransfersSchema(
            pagination=PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=math.ceil(total_count / pagination.size),
            ),
            notional_transfers=[
                NotionalTransferSchema.model_validate(nt) for nt in notional_transfers
            ],
        )

    @service_handler
    async def update_notional_transfer(
        self,
        notional_transfer_data: NotionalTransferCreateSchema,
    ) -> NotionalTransferSchema:
        """Update an existing notional transfer"""
        existing_transfer = await self.repo.get_latest_notional_transfer_by_group_uuid(
            notional_transfer_data.group_uuid
        )
        if not existing_transfer:
            raise ValueError("Notional transfer not found")

        if (
            existing_transfer.compliance_report_id
            == notional_transfer_data.compliance_report_id
        ):
            # Update existing record if compliance report ID matches
            for field, value in notional_transfer_data.model_dump(
                exclude=NOTIONAL_TRANSFER_EXCLUDE_FIELDS.union({"fuel_category"})
            ).items():
                setattr(existing_transfer, field, value)

            if (
                existing_transfer.fuel_category.category
                != notional_transfer_data.fuel_category
            ):
                existing_transfer.fuel_category = (
                    await self.fuel_repo.get_fuel_category_by(
                        category=notional_transfer_data.fuel_category
                    )
                )

            updated_transfer = await self.repo.update_notional_transfer(
                existing_transfer
            )
            return self.model_to_schema(updated_transfer)
        else:
            # Create a new version of the record
            return await self.create_notional_transfer(
                notional_transfer_data, existing_record=existing_transfer
            )

    @service_handler
    async def create_notional_transfer(
        self,
        notional_transfer_data: NotionalTransferCreateSchema,
        existing_record: Optional[NotionalTransfer] = None,
    ) -> NotionalTransferSchema:
        """Create a new notional transfer"""
        notional_transfer = await self.convert_to_model(notional_transfer_data)
        new_group_uuid = str(uuid.uuid4())
        notional_transfer.group_uuid = (
            new_group_uuid if not existing_record else existing_record.group_uuid
        )
        notional_transfer.action_type = (
            ActionTypeEnum.CREATE if not existing_record else ActionTypeEnum.UPDATE
        )
        notional_transfer.version = (
            0 if not existing_record else existing_record.version + 1
        )
        notional_transfer.create_date = (
            existing_record.create_date if existing_record else None
        )
        notional_transfer.create_user = (
            existing_record.create_user if existing_record else None
        )
        created_transfer = await self.repo.create_notional_transfer(notional_transfer)

        return self.model_to_schema(created_transfer)

    @service_handler
    async def delete_notional_transfer(
        self,
        notional_transfer_data: NotionalTransferCreateSchema,
    ) -> DeleteNotionalTransferResponseSchema:
        """Delete a notional transfer"""
        existing_transfer = await self.repo.get_latest_notional_transfer_by_group_uuid(
            notional_transfer_data.group_uuid
        )

        if (
            existing_transfer.compliance_report_id
            == notional_transfer_data.compliance_report_id
        ):
            await self.repo.delete_notional_transfer(
                notional_transfer_id=notional_transfer_data.notional_transfer_id
            )
            return DeleteNotionalTransferResponseSchema(message="Marked as deleted.")
        else:
            deleted_entity = NotionalTransfer(
                compliance_report_id=notional_transfer_data.compliance_report_id,
                group_uuid=notional_transfer_data.group_uuid,
                version=existing_transfer.version + 1,
                action_type=ActionTypeEnum.DELETE,
            )

            # Copy fields from the latest version for the deletion record
            for field in existing_transfer.__table__.columns.keys():
                if field not in NOTIONAL_TRANSFER_EXCLUDE_FIELDS:
                    setattr(deleted_entity, field, getattr(existing_transfer, field))

            deleted_entity.compliance_report_id = (
                notional_transfer_data.compliance_report_id
            )

            await self.repo.create_notional_transfer(deleted_entity)
        return DeleteNotionalTransferResponseSchema(message="Marked as deleted.")

    @service_handler
    async def get_compliance_report_by_id(self, compliance_report_id: int):
        """Get compliance report by period with status"""
        compliance_report = (
            await self.compliance_report_repo.get_compliance_report_schema_by_id(
                compliance_report_id,
            )
        )

        if not compliance_report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Compliance report not found for this period",
            )

        return compliance_report
