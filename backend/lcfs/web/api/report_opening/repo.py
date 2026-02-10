from datetime import datetime
from typing import List, Sequence

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.compliance.ReportOpening import (
    ReportOpening,
    SupplementalReportAccessRole,
)
from lcfs.web.api.report_opening.constants import configured_years
from lcfs.web.core.decorators import repo_handler


class ReportOpeningRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)) -> None:
        self.db = db

    def _build_default_record(self, year: int) -> ReportOpening:
        current_year = datetime.utcnow().year
        return ReportOpening(
            compliance_year=year,
            compliance_reporting_enabled=year <= current_year,
            early_issuance_enabled=False,
            supplemental_report_role=SupplementalReportAccessRole.BCeID,
        )

    @repo_handler
    async def list_all(self) -> Sequence[ReportOpening]:
        result = await self.db.execute(
            select(ReportOpening).order_by(ReportOpening.compliance_year)
        )
        return result.scalars().all()

    @repo_handler
    async def ensure_year(self, year: int) -> ReportOpening:
        result = await self.db.execute(
            select(ReportOpening).where(ReportOpening.compliance_year == year)
        )
        record = result.scalars().first()
        if record:
            return record

        record = self._build_default_record(year)
        self.db.add(record)
        await self.db.flush()
        return record

    @repo_handler
    async def sync_configured_years(self) -> List[ReportOpening]:
        years = configured_years()
        if not years:
            return []

        result = await self.db.execute(
            select(ReportOpening).where(ReportOpening.compliance_year.in_(years))
        )
        records = result.scalars().all()
        existing_years = {record.compliance_year for record in records}
        missing_years = [year for year in years if year not in existing_years]

        if missing_years:
            for year in missing_years:
                new_record = self._build_default_record(year)
                self.db.add(new_record)
                records.append(new_record)
            await self.db.flush()

        return sorted(records, key=lambda record: record.compliance_year)

    @repo_handler
    async def upsert_year(
        self,
        year: int,
        *,
        compliance_reporting_enabled: bool | None = None,
        early_issuance_enabled: bool | None = None,
        supplemental_report_role: SupplementalReportAccessRole | None = None,
    ) -> ReportOpening:
        result = await self.db.execute(
            select(ReportOpening).where(ReportOpening.compliance_year == year)
        )
        record = result.scalars().first()
        if not record:
            record = self._build_default_record(year)
            self.db.add(record)

        if compliance_reporting_enabled is not None:
            record.compliance_reporting_enabled = compliance_reporting_enabled

        if early_issuance_enabled is not None:
            record.early_issuance_enabled = early_issuance_enabled

        if supplemental_report_role is not None:
            record.supplemental_report_role = supplemental_report_role

        await self.db.flush()
        return record
