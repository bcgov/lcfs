import structlog
from fastapi import Depends
from sqlalchemy import select, func, and_, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from typing import List, Optional, Tuple

from lcfs.db.base import ActionTypeEnum
from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.compliance import ComplianceReport
from lcfs.db.models.compliance.NotionalTransfer import (
    NotionalTransfer,
    ReceivedOrTransferredEnum,
)
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.api.notional_transfer.schema import NotionalTransferSchema
from lcfs.web.core.decorators import repo_handler

logger = structlog.get_logger(__name__)


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
        self,
        compliance_report_id: int,
        changelog: bool = False,
    ) -> List[NotionalTransferSchema]:
        """
        Queries notional transfers from the database for a specific compliance report.
        """
        # Retrieve the compliance report's group UUID
        report_group_query = await self.db.execute(
            select(ComplianceReport.compliance_report_group_uuid).where(
                ComplianceReport.compliance_report_id == compliance_report_id
            )
        )
        group_uuid = report_group_query.scalar()
        if not group_uuid:
            return []

        result = await self.get_effective_notional_transfers(
            compliance_report_group_uuid=group_uuid,
            compliance_report_id=compliance_report_id,
            changelog=changelog
        )
        return result

    async def get_effective_notional_transfers(
        self,
        compliance_report_group_uuid: str,
        compliance_report_id: int,
        changelog: bool = False,
    ) -> List[NotionalTransferSchema]:
        """
        Retrieves effective notional transfers for a compliance report group UUID.
        """
        # Step 1: Get all compliance_report_ids in the specified group
        compliance_reports_select = select(ComplianceReport.compliance_report_id).where(
            and_(
                ComplianceReport.compliance_report_group_uuid
                == compliance_report_group_uuid,
                ComplianceReport.compliance_report_id <= compliance_report_id,
            )
        )

        # Step 2: Find the maximum version and priority per group_uuid, excluding deleted groups
        conditions = [
            NotionalTransfer.compliance_report_id.in_(compliance_reports_select)
        ]
        if not changelog:
            delete_group_select = (
                select(NotionalTransfer.group_uuid)
                .where(
                    NotionalTransfer.compliance_report_id.in_(
                        compliance_reports_select
                    ),
                    NotionalTransfer.action_type == ActionTypeEnum.DELETE,
                )
                .distinct()
            )
            conditions.extend(
                [
                    NotionalTransfer.action_type != ActionTypeEnum.DELETE,
                    ~NotionalTransfer.group_uuid.in_(delete_group_select),
                ]
            )

        valid_notional_transfers_select = (
            select(
                NotionalTransfer.group_uuid,
                func.max(NotionalTransfer.version).label("max_version"),
            )
            .where(*conditions)
            .group_by(NotionalTransfer.group_uuid)
        )
        valid_notional_transfers_subq = valid_notional_transfers_select.subquery()

        notional_transfers_select = (
            select(NotionalTransfer)
            .options(joinedload(NotionalTransfer.fuel_category))
            .join(
                valid_notional_transfers_subq,
                and_(
                    NotionalTransfer.group_uuid
                    == valid_notional_transfers_subq.c.group_uuid,
                    NotionalTransfer.version
                    == valid_notional_transfers_subq.c.max_version,
                ),
            )
            .order_by(NotionalTransfer.notional_transfer_id)
        )

        result = await self.db.execute(notional_transfers_select)
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
                group_uuid=nt.group_uuid,
                version=nt.version,
                action_type=nt.action_type,
            )
            for nt in notional_transfers
        ]

    async def get_notional_transfers_paginated(
        self,
        pagination: PaginationRequestSchema,
        compliance_report_id: int,
    ) -> Tuple[List[NotionalTransferSchema], int]:
        # Retrieve the compliance report's group UUID
        report_group_query = await self.db.execute(
            select(ComplianceReport.compliance_report_group_uuid).where(
                ComplianceReport.compliance_report_id == compliance_report_id
            )
        )
        group_uuid = report_group_query.scalar()
        if not group_uuid:
            return [], 0

        # Retrieve effective notional transfers using the group UUID
        notional_transfers = await self.get_effective_notional_transfers(
            compliance_report_group_uuid=group_uuid,
            compliance_report_id=compliance_report_id,
        )

        # Manually apply pagination
        total_count = len(notional_transfers)
        offset = 0 if pagination.page < 1 else (pagination.page - 1) * pagination.size
        limit = pagination.size
        paginated_notional_transfers = notional_transfers[offset : offset + limit]

        return paginated_notional_transfers, total_count

    @repo_handler
    async def save_notional_transfers(
        self, notional_transfers: List[NotionalTransfer]
    ) -> str:
        """
        Saves or updates notional transfers in the database.
        """
        for transfer in notional_transfers:
            if transfer.notional_transfer_id:
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
            else:
                self.db.add(transfer)

        await self.db.flush()
        return "Notional transfers saved or updated successfully"

    @repo_handler
    async def get_notional_transfer(
        self, notional_transfer_id: int
    ) -> Optional[NotionalTransfer]:
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
    async def get_latest_notional_transfer_by_group_uuid(
        self, group_uuid: str
    ) -> Optional[NotionalTransfer]:
        """
        Retrieve the latest NotionalTransfer record for a given group UUID.
        """
        query = (
            select(NotionalTransfer)
            .options(joinedload(NotionalTransfer.fuel_category))
            .where(NotionalTransfer.group_uuid == group_uuid)
            .order_by(
                NotionalTransfer.version.desc(),
            )
        )

        result = await self.db.execute(query)
        return result.scalars().first()

    @repo_handler
    async def get_notional_transfer_version_by_user(
        self, group_uuid: str, version: int
    ) -> Optional[NotionalTransfer]:
        """
        Retrieve a specific NotionalTransfer record by group UUID, version, and user_type.
        """
        query = (
            select(NotionalTransfer)
            .where(
                NotionalTransfer.group_uuid == group_uuid,
                NotionalTransfer.version == version,
                NotionalTransfer.user_type == user_type,
            )
            .options(joinedload(NotionalTransfer.fuel_category))
        )

        result = await self.db.execute(query)
        return result.scalars().first()

    async def delete_notional_transfer(self, notional_transfer_id):
        await self.db.execute(
            delete(NotionalTransfer).where(
                NotionalTransfer.notional_transfer_id == notional_transfer_id
            )
        )
