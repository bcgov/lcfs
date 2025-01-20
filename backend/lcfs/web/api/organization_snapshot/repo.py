import structlog
from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import immediateload

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models import ComplianceReportOrganizationSnapshot, Organization
from lcfs.web.core.decorators import repo_handler
from lcfs.web.exception.exceptions import DataNotFoundException

logger = structlog.get_logger(__name__)


class OrganizationSnapshotRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    @repo_handler
    async def get_by_compliance_report_id(self, compliance_report_id: int):
        """
        Retrieves the organization snapshot associated with a specific compliance report.
        Raises DataNotFoundException if not found.
        """
        stmt = select(ComplianceReportOrganizationSnapshot).where(
            ComplianceReportOrganizationSnapshot.compliance_report_id
            == compliance_report_id
        )
        result = await self.db.execute(stmt)
        snapshot = result.scalar_one_or_none()

        if not snapshot:
            raise DataNotFoundException(
                f"No Organization Snapshot found for compliance_report_id={compliance_report_id}"
            )

        return snapshot

    @repo_handler
    async def get_organization(self, organization_id: int) -> Organization | None:
        stmt = (
            select(Organization)
            .options(
                immediateload(Organization.org_address),
                immediateload(Organization.org_attorney_address),
            )
            .where(Organization.organization_id == organization_id)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    @repo_handler
    async def save_snapshot(self, org_snapshot):
        self.db.add(org_snapshot)
        await self.db.flush()
        await self.db.refresh(org_snapshot)
        return org_snapshot
