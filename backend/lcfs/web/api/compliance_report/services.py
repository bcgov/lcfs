from logging import getLogger
import math
from typing import List
from fastapi import Depends, Request
from sqlalchemy import select

from lcfs.db.models.compliance.ComplianceReport import ComplianceReport
from lcfs.db.models.compliance.SupplementalReport import SupplementalReport
from lcfs.db.models.compliance.ComplianceReportSummary import ComplianceReportSummary
from lcfs.web.api.base import PaginationResponseSchema
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.compliance_report.schema import (
    CompliancePeriodSchema,
    ComplianceReportBaseSchema,
    ComplianceReportCreateSchema,
    ComplianceReportListSchema,
)
from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import DataNotFoundException
from lcfs.web.api.compliance_report.summary_service import (
    ComplianceReportSummaryService,
)
from lcfs.web.api.compliance_report.update_service import ComplianceReportUpdateService

logger = getLogger(__name__)


class ComplianceReportServices:
    def __init__(
        self, request: Request = None, repo: ComplianceReportRepository = Depends()
    ) -> None:
        self.request = request
        self.repo = repo
        self.summary_service = ComplianceReportSummaryService()
        self.update_service = ComplianceReportUpdateService(repo, request)

    @service_handler
    async def get_all_compliance_periods(self) -> List[CompliancePeriodSchema]:
        """Fetches all compliance periods and converts them to Pydantic models."""
        periods = await self.repo.get_all_compliance_periods()
        return [CompliancePeriodSchema.model_validate(period) for period in periods]

    @service_handler
    async def create_compliance_report(
        self, organization_id: int, report_data: ComplianceReportCreateSchema
    ) -> ComplianceReportBaseSchema:
        """Creates a new compliance report."""
        period = await self.repo.get_compliance_period(report_data.compliance_period)
        draft_status = await self.repo.get_compliance_report_status_by_desc(
            report_data.status
        )
        report = await self.repo.add_compliance_report(
            ComplianceReport(
                compliance_period=period,
                organization_id=organization_id,
                current_status=draft_status,
                summary=ComplianceReportSummary(),  # Create an empty summary object
            )
        )
        await self.repo.add_compliance_report_history(report, self.request.user)

        return report

    @service_handler
    async def get_compliance_reports_paginated(
        self, pagination, organization_id: int = None
    ):
        """Fetches all compliance reports"""

        reports, total_count = await self.repo.get_reports_paginated(
            pagination, organization_id
        )
        if len(reports) == 0:
            raise DataNotFoundException("No compliance reports found.")

        return ComplianceReportListSchema(
            pagination=PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=math.ceil(total_count / pagination.size),
            ),
            reports=reports,
        )

    @service_handler
    async def get_compliance_report_by_id(
        self, report_id: int
    ) -> ComplianceReportBaseSchema:
        """Fetches a specific compliance report by ID."""
        report = await self.repo.get_compliance_report_by_id(report_id)
        if report is None:
            raise DataNotFoundException("Compliance report not found.")
        return report

    @service_handler
    async def get_supplemental_reports(
        self, original_report_id: int
    ) -> List[SupplementalReport]:
        """
        Retrieve all supplemental reports for a given original compliance report,
        ordered by version.
        """
        query = (
            select(SupplementalReport)
            .where(SupplementalReport.original_report_id == original_report_id)
            .order_by(SupplementalReport.version)
        )

        result = await self.repo.db.execute(query)
        return result.scalars().all()

    @service_handler
    async def get_all_org_reported_years(
        self, organization_id: int
    ) -> List[CompliancePeriodSchema]:
        return await self.repo.get_all_org_reported_years(organization_id)
