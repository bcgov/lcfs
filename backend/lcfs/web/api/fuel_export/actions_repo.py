from typing import Optional, List

from fastapi import Depends
from sqlalchemy import and_, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.base import ActionTypeEnum, UserTypeEnum
from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.compliance import ComplianceReport
from lcfs.db.models.compliance.FuelExport import FuelExport
from lcfs.web.core.decorators import repo_handler


class FuelExportActionsRepo:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_report_version(self, compliance_report_id: int) -> Optional[int]:
        """
        Retrieve just the version number for a given compliance report ID.
        """
        result = await self.db.scalar(
            select(ComplianceReport.version).where(
                ComplianceReport.compliance_report_id == compliance_report_id
            )
        )
        return result

    @repo_handler
    async def get_fuel_export_by_group_uuid_and_report_version(
        self,
        group_uuid: str,
        report_version: int,
    ) -> Optional[FuelExport]:
        """
        Fetch a FuelExport record by group UUID and report version.
        """
        query = select(FuelExport).where(
            FuelExport.group_uuid == group_uuid,
            FuelExport.version == report_version,
        )
        result = await self.db.execute(query)
        return result.scalars().first()

    @repo_handler
    async def get_latest_fuel_export_by_group_uuid_before_version(
        self,
        group_uuid: str,
        report_version: int,
    ) -> Optional[FuelExport]:
        """
        Fetch the latest FuelExport record by group UUID before a given report version.
        """
        query = (
            select(FuelExport)
            .where(
                FuelExport.group_uuid == group_uuid,
                FuelExport.version < report_version,
            )
            .order_by(FuelExport.version.desc())
            .limit(1)
        )
        result = await self.db.execute(query)
        return result.scalars().first()

    @repo_handler
    async def delete_fuel_export_by_group_uuid(self, group_uuid: str) -> bool:
        """
        Physically delete a FuelExport record by group UUID.
        """
        result = await self.db.execute(
            delete(FuelExport).where(FuelExport.group_uuid == group_uuid)
        )
        await self.db.flush()
        return result.rowcount > 0

    @repo_handler
    async def get_fuel_export_by_group_uuid_and_action(
        self,
        group_uuid: str,
        version: int,
        action_type: ActionTypeEnum,
    ) -> Optional[FuelExport]:
        """
        Fetch a FuelExport record by group UUID, version, and action type.
        """
        query = select(FuelExport).where(
            FuelExport.group_uuid == group_uuid,
            FuelExport.version == version,
            FuelExport.action_type == action_type,
        )
        result = await self.db.execute(query)
        return result.scalars().first()
