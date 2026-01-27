from typing import List

from fastapi import Depends

from lcfs.web.api.report_opening.constants import configured_years
from lcfs.web.api.report_opening.repo import ReportOpeningRepository
from lcfs.web.api.report_opening.schema import (
    ReportOpeningSchema,
    ReportOpeningUpdateRequest,
    model_to_schema,
)
from lcfs.web.core.decorators import service_handler


class ReportOpeningService:
    def __init__(self, repo: ReportOpeningRepository = Depends()) -> None:
        self.repo = repo

    def _validate_years(self, years: List[int]) -> None:
        allowed = set(configured_years())
        invalid = [year for year in years if year not in allowed]
        if invalid:
            invalid_str = ", ".join(str(year) for year in sorted(invalid))
            raise ValueError(
                f"Configuration for years {invalid_str} is not supported."
            )

    @service_handler
    async def get_report_openings(self) -> List[ReportOpeningSchema]:
        records = await self.repo.sync_configured_years()
        return [model_to_schema(record) for record in records]

    @service_handler
    async def update_report_openings(
        self, payload: ReportOpeningUpdateRequest
    ) -> List[ReportOpeningSchema]:
        years = [entry.compliance_year for entry in payload.report_openings]
        self._validate_years(years)

        # Ensure defaults exist before applying updates so the caller gets a full list back.
        await self.repo.sync_configured_years()

        for update in payload.report_openings:
            await self.repo.upsert_year(
                update.compliance_year,
                compliance_reporting_enabled=update.compliance_reporting_enabled,
            )

        records = await self.repo.sync_configured_years()
        return [model_to_schema(record) for record in records]
