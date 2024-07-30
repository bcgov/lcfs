from logging import getLogger
import math
from typing import List, Dict
from fastapi import Depends, Request

from lcfs.db.models.compliance.ComplianceReport import ComplianceReport
from lcfs.web.api.base import PaginationResponseSchema
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.compliance_report.schema import (
    CompliancePeriodSchema,
    ComplianceReportBaseSchema,
    ComplianceReportCreateSchema,
    ComplianceReportListSchema,
    ComplianceReportSummaryRowSchema,
    ComplianceReportUpdateSchema
)
from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import DataNotFoundException
from lcfs.web.api.compliance_report.summary import ComplianceReportSummaryCalculatorService
from lcfs.web.api.compliance_report.update import ComplianceReportUpdateService

logger = getLogger(__name__)

class ComplianceReportServices:
    def __init__(
        self, request: Request = None, repo: ComplianceReportRepository = Depends()
    ) -> None:
        self.request = request
        self.repo = repo
        self.summary_calculator = ComplianceReportSummaryCalculatorService()
        self.updater = ComplianceReportUpdateService(repo, request)

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
                status=draft_status,
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
    async def get_compliance_report_summary(self, report_id: int) -> Dict[str, List[ComplianceReportSummaryRowSchema]]:
        """Generate the comprehensive compliance report summary for a specific compliance report by ID."""

        fossil_quantities = {'gasoline': 10000, 'diesel': 20000, 'jet_fuel': 3000}
        renewable_quantities = {'gasoline': 5000, 'diesel': 15000, 'jet_fuel': 1000}
        previous_retained = {'gasoline': 200, 'diesel': 400, 'jet_fuel': 100}

        renewable_fuel_target_summary = self.summary_calculator.calculate_renewable_fuel_target_summary(
            fossil_quantities, renewable_quantities, previous_retained)
        low_carbon_fuel_target_summary = self.summary_calculator.calculate_low_carbon_fuel_target_summary()
        non_compliance_penalty_summary = self.summary_calculator.calculate_non_compliance_penalty_summary()

        summary = {
            'renewableFuelTargetSummary': renewable_fuel_target_summary,
            'lowCarbonFuelTargetSummary': low_carbon_fuel_target_summary,
            'nonCompliancePenaltySummary': non_compliance_penalty_summary
        }

        return summary

    @service_handler
    async def update_compliance_report(self, report_id: int, report_data: ComplianceReportUpdateSchema) -> ComplianceReportBaseSchema:
        """Updates an existing compliance report."""
        return await self.updater.update_compliance_report(report_id, report_data)
