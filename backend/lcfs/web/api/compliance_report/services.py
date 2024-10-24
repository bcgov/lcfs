from logging import getLogger
import math
from typing import List
from fastapi import Depends, Request

from lcfs.db.models.compliance.ComplianceReport import ComplianceReport
from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum
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

logger = getLogger(__name__)


class ComplianceReportServices:
    def __init__(
        self, request: Request = None, repo: ComplianceReportRepository = Depends()
    ) -> None:
        self.request = request
        self.repo = repo

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
        self, pagination, organization_id: int = None, bceid_user: bool = False
    ):
        """Fetches all compliance reports"""
        if bceid_user:
            for filter in pagination.filters:
                if filter.field == "status" and filter.filter == ComplianceReportStatusEnum.Submitted.value:
                    filter.filter_type = "set"
                    filter.filter = [
                        ComplianceReportStatusEnum.Recommended_by_analyst,
                        ComplianceReportStatusEnum.Recommended_by_manager,
                        ComplianceReportStatusEnum.Submitted,
                    ]
        reports, total_count = await self.repo.get_reports_paginated(
            pagination, organization_id
        )

        if not reports:
            raise DataNotFoundException("No compliance reports found.")

        if bceid_user:
            reports = self._mask_report_status(reports)

        return ComplianceReportListSchema(
            pagination=PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=math.ceil(total_count / pagination.size),
            ),
            reports=reports,
        )

    def _mask_report_status(self, reports: List) -> List:
        recommended_statuses = {
            ComplianceReportStatusEnum.Recommended_by_analyst.value,
            ComplianceReportStatusEnum.Recommended_by_manager.value,
        }

        masked_reports = []
        for report in reports:
            if report.current_status.status in recommended_statuses:
                report.current_status.status = ComplianceReportStatusEnum.Submitted.value
                report.current_status.compliance_report_status_id = None
                masked_reports.append(report)
            else:
                masked_reports.append(report)

        return masked_reports

    @service_handler
    async def get_compliance_report_by_id(
        self, report_id: int, bceid_user: bool = False
    ) -> ComplianceReportBaseSchema:
        """Fetches a specific compliance report by ID."""
        report = await self.repo.get_compliance_report_by_id(report_id)
        if report is None:
            raise DataNotFoundException("Compliance report not found.")
        validated_report = ComplianceReportBaseSchema.model_validate(report)
        masked_report = self._mask_report_status_for_history(validated_report, bceid_user)
        return masked_report
    
    def _mask_report_status_for_history(self, report: ComplianceReportBaseSchema, bceid_user: bool = False) -> ComplianceReportBaseSchema:
        recommended_statuses = {
            ComplianceReportStatusEnum.Recommended_by_analyst.value,
            ComplianceReportStatusEnum.Recommended_by_manager.value,
        }
        if bceid_user or report.current_status.status == ComplianceReportStatusEnum.Submitted.value:
            report.history = [h for h in report.history if h.status.status not in recommended_statuses]
        elif report.current_status.status == ComplianceReportStatusEnum.Recommended_by_analyst.value:
            report.history = [h for h in report.history if h.status.status != ComplianceReportStatusEnum.Recommended_by_manager.value]
        
        return report

    @service_handler
    async def get_all_org_reported_years(
        self, organization_id: int
    ) -> List[CompliancePeriodSchema]:
        return await self.repo.get_all_org_reported_years(organization_id)
