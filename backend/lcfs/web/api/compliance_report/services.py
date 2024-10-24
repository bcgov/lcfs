from logging import getLogger
import math
from typing import List
from fastapi import Depends, Request

from lcfs.db.models.compliance.ComplianceReport import ComplianceReport
from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum
from lcfs.db.models.compliance.ComplianceReportSummary import ComplianceReportSummary
from lcfs.db.models.user import UserProfile
from lcfs.web.api.base import PaginationResponseSchema
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.compliance_report.schema import (
    CompliancePeriodSchema,
    ComplianceReportBaseSchema,
    ComplianceReportCreateSchema,
    ComplianceReportListSchema,
)
from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import DataNotFoundException, ServiceException

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
        report = ComplianceReport(
            compliance_period=period,
            organization_id=organization_id,
            current_status=draft_status,
            summary=ComplianceReportSummary(),  # Create an empty summary object
            original_report_id=None,
            previous_report_id=None,
            chain_index=0,
            nickname="Original Report",
        )

        # Update original_report_id to compliance_report_id
        report.original_report_id = report.compliance_report_id
        report = await self.repo.update_compliance_report(report)

        # Add the new compliance report
        await self.repo.add_compliance_report(report)

        # Create the history record
        await self.repo.add_compliance_report_history(report, self.request.user)

        return report

    @service_handler
    async def create_supplemental_report(
        self, report_id: int
    ) -> ComplianceReportBaseSchema:
        """
        Creates a new supplemental compliance report.
        The report_id can be any report in the chain (original or supplemental).
        Supplementals only allowed if the status of the current report is 'Assessed'.
        """

        user: UserProfile = self.request.user

        # Fetch the report corresponding to the given report_id
        current_report = await self.repo.get_compliance_report_by_id(
            report_id, is_model=True
        )
        if not current_report:
            raise DataNotFoundException("Compliance report not found.")

        # Validate that the status of the current report is 'Assessed'
        # if current_report.current_status.status != ComplianceReportStatusEnum.Assessed:
        #     raise ServiceException(
        #         "A supplemental report can only be created if the current report's status is 'Assessed'."
        #     )

        # Determine the original_report_id
        original_report_id = (
            current_report.original_report_id or current_report.compliance_report_id
        )

        # Fetch the original report
        original_report = await self.repo.get_compliance_report_by_id(
            original_report_id, is_model=True
        )
        if not original_report:
            raise DataNotFoundException("Original compliance report not found.")

        # Validate that the user is allowed to create a supplemental report
        if user.organization_id != original_report.organization_id:
            raise ServiceException(
                "You do not have permission to create a supplemental report for this organization."
            )

        # Get the last report in the chain
        last_report_in_chain = await self.repo.get_last_report_in_chain(
            original_report_id
        )
        chain_index = (
            last_report_in_chain.chain_index + 1 if last_report_in_chain else 1
        )
        previous_report_id = last_report_in_chain.compliance_report_id

        # Get the 'Draft' status
        draft_status = await self.repo.get_compliance_report_status_by_desc("Draft")
        if not draft_status:
            raise DataNotFoundException("Draft status not found.")

        # Create the new supplemental compliance report
        new_report = ComplianceReport(
            compliance_period_id=original_report.compliance_period_id,
            organization_id=original_report.organization_id,
            current_status_id=draft_status.compliance_report_status_id,
            reporting_frequency=original_report.reporting_frequency,
            # Supplemental fields
            original_report_id=original_report_id,
            previous_report_id=previous_report_id,
            chain_index=chain_index,
            nickname=f"Supplemental Report {chain_index}",
            summary=ComplianceReportSummary(),  # Create an empty summary object
        )

        # Add the new supplemental report
        new_report = await self.repo.add_compliance_report(new_report)

        # Create the history record for the new supplemental report
        await self.repo.add_compliance_report_history(new_report, user)

        return ComplianceReportBaseSchema.model_validate(new_report)

    @service_handler
    async def get_compliance_reports_paginated(
        self, pagination, organization_id: int = None, bceid_user: bool = False
    ):
        """Fetches all compliance reports"""
        if bceid_user:
            for filter in pagination.filters:
                if (
                    filter.field == "status"
                    and filter.filter == ComplianceReportStatusEnum.Submitted.value
                ):
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
                report.current_status.status = (
                    ComplianceReportStatusEnum.Submitted.value
                )
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
        masked_report = self._mask_report_status_for_history(
            validated_report, bceid_user
        )
        return masked_report

    def _mask_report_status_for_history(
        self, report: ComplianceReportBaseSchema, bceid_user: bool = False
    ) -> ComplianceReportBaseSchema:
        recommended_statuses = {
            ComplianceReportStatusEnum.Recommended_by_analyst.value,
            ComplianceReportStatusEnum.Recommended_by_manager.value,
        }
        if (
            bceid_user
            or report.current_status.status
            == ComplianceReportStatusEnum.Submitted.value
        ):
            report.history = [
                h for h in report.history if h.status.status not in recommended_statuses
            ]
        elif (
            report.current_status.status
            == ComplianceReportStatusEnum.Recommended_by_analyst.value
        ):
            report.history = [
                h
                for h in report.history
                if h.status.status
                != ComplianceReportStatusEnum.Recommended_by_manager.value
            ]

        return report

    @service_handler
    async def get_all_org_reported_years(
        self, organization_id: int
    ) -> List[CompliancePeriodSchema]:
        return await self.repo.get_all_org_reported_years(organization_id)
