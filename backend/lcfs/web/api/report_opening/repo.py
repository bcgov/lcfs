from datetime import datetime
from typing import List, Sequence

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.compliance.ReportOpening import ReportOpening
from lcfs.web.api.report_opening.constants import (
    DEFAULT_CLOSED_COMPLIANCE_REPORTING_YEARS,
    configured_years,
)
from lcfs.web.core.decorators import repo_handler


class ReportOpeningRepository:
    def __init__(
        self, db: AsyncSession = Depends(get_async_db_session, scope="function")
    ) -> None:
        self.db = db

    def _build_default_record(self, year: int) -> ReportOpening:
        current_year = datetime.utcnow().year
        return ReportOpening(
            compliance_year=year,
            compliance_reporting_enabled=(
                year <= current_year
                and year not in DEFAULT_CLOSED_COMPLIANCE_REPORTING_YEARS
            ),
            early_issuance_enabled=False,
            create_supplemental_enabled=year >= current_year,
        )

    async def _insert_default_records(self, years: Sequence[int]) -> None:
        """Create missing opening rows safely when requests race on first access."""
        if not years:
            return

        records = [self._build_default_record(year) for year in years]
        statement = (
            pg_insert(ReportOpening)
            .values(
                [
                    {
                        "compliance_year": record.compliance_year,
                        "compliance_reporting_enabled": record.compliance_reporting_enabled,
                        "early_issuance_enabled": record.early_issuance_enabled,
                        "create_supplemental_enabled": record.create_supplemental_enabled,
                    }
                    for record in records
                ]
            )
            .on_conflict_do_nothing(index_elements=[ReportOpening.compliance_year])
        )
        await self.db.execute(statement)

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

        await self._insert_default_records([year])
        result = await self.db.execute(
            select(ReportOpening).where(ReportOpening.compliance_year == year)
        )
        return result.scalars().one()

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
            await self._insert_default_records(missing_years)
            result = await self.db.execute(
                select(ReportOpening).where(ReportOpening.compliance_year.in_(years))
            )
            records = result.scalars().all()

        return sorted(records, key=lambda record: record.compliance_year)

    @repo_handler
    async def upsert_year(
        self,
        year: int,
        *,
        compliance_reporting_enabled: bool | None = None,
        early_issuance_enabled: bool | None = None,
        create_supplemental_enabled: bool | None = None,
    ) -> ReportOpening:
        result = await self.db.execute(
            select(ReportOpening).where(ReportOpening.compliance_year == year)
        )
        record = result.scalars().first()
        if not record:
            await self._insert_default_records([year])
            result = await self.db.execute(
                select(ReportOpening).where(ReportOpening.compliance_year == year)
            )
            record = result.scalars().one()

        if compliance_reporting_enabled is not None:
            record.compliance_reporting_enabled = compliance_reporting_enabled

        if early_issuance_enabled is not None:
            record.early_issuance_enabled = early_issuance_enabled

        if create_supplemental_enabled is not None:
            record.create_supplemental_enabled = create_supplemental_enabled

        await self.db.flush()
        return record
