import math
import uuid
from typing import List

import structlog
from fastapi import Depends

from lcfs.db.models.compliance.ComplianceReport import (
    ComplianceReport,
    SupplementalInitiatorType,
    ReportingFrequency,
)
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
from lcfs.web.api.organization_snapshot.services import OrganizationSnapshotService
from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import DataNotFoundException, ServiceException

logger = structlog.get_logger(__name__)


class ComplianceReportServices:
    def __init__(
        self,
        repo: ComplianceReportRepository = Depends(),
        snapshot_services: OrganizationSnapshotService = Depends(),
    ) -> None:
        self.repo = repo
        self.snapshot_services = snapshot_services

    @service_handler
    async def get_all_compliance_periods(self) -> List[CompliancePeriodSchema]:
        """Fetches all compliance periods and converts them to Pydantic models."""
        periods = await self.repo.get_all_compliance_periods()
        return [CompliancePeriodSchema.model_validate(period) for period in periods]

    @service_handler
    async def create_compliance_report(
        self,
        organization_id: int,
        report_data: ComplianceReportCreateSchema,
        user: UserProfile,
    ) -> ComplianceReportBaseSchema:
        """Creates a new compliance report."""
        period = await self.repo.get_compliance_period(report_data.compliance_period)
        if not period:
            raise DataNotFoundException("Compliance period not found.")

        draft_status = await self.repo.get_compliance_report_status_by_desc(
            report_data.status
        )
        if not draft_status:
            raise DataNotFoundException(f"Status '{report_data.status}' not found.")

        # Generate a new group_uuid for the new report series
        group_uuid = str(uuid.uuid4())

        report = ComplianceReport(
            compliance_period_id=period.compliance_period_id,
            organization_id=organization_id,
            current_status_id=draft_status.compliance_report_status_id,
            reporting_frequency=ReportingFrequency.ANNUAL,
            compliance_report_group_uuid=group_uuid,  # New group_uuid for the series
            version=0,  # Start with version 0
            nickname=report_data.nickname or "Original Report",
            summary=ComplianceReportSummary(),  # Create an empty summary object
            legacy_id=report_data.legacy_id,
            create_user=user.keycloak_username,
        )

        # Add the new compliance report
        report = await self.repo.create_compliance_report(report)

        # Snapshot the Organization Details
        await self.snapshot_services.create_organization_snapshot(
            report.compliance_report_id, organization_id
        )

        # Create the history record
        await self.repo.add_compliance_report_history(report, user)

        return ComplianceReportBaseSchema.model_validate(report)

    @service_handler
    async def create_supplemental_report(
        self, report_id: int, user: UserProfile = None, legacy_id: int = None
    ) -> ComplianceReportBaseSchema:
        """
        Creates a new supplemental compliance report.
        The report_id can be any report in the series (original or supplemental).
        Supplemental reports are only allowed if the status of the current report is 'Assessed'.
        """
        # check if we're passing a specifc user otherwise use request user
        if not user:
            user = self.request.user

        # Fetch the current report using the provided report_id
        current_report = await self.repo.get_compliance_report_by_id(
            report_id, is_model=True
        )
        if not current_report:
            raise DataNotFoundException("Compliance report not found.")

        # Validate that the user has permission to create a supplemental report
        if user.organization_id != current_report.organization_id:
            raise ServiceException(
                "You do not have permission to create a supplemental report for this organization."
            )

        # TODO this logic to be re-instated once TFRS is shutdown
        # TFRS allows supplementals on previously un-accepted reports
        # so we have to support this until LCFS and TFRS are no longer synced
        # Validate that the status of the current report is 'Assessed'
        # if current_report.current_status.status != ComplianceReportStatusEnum.Assessed:
        #     raise ServiceException(
        #         "A supplemental report can only be created if the current report's status is 'Assessed'."
        #     )

        # Get the group_uuid from the current report
        group_uuid = current_report.compliance_report_group_uuid

        # Fetch the latest version number for the given group_uuid
        latest_report = await self.repo.get_latest_report_by_group_uuid(group_uuid)
        if not latest_report:
            raise DataNotFoundException("Latest compliance report not found.")

        new_version = latest_report.version + 1

        # Get the 'Draft' status
        draft_status = await self.repo.get_compliance_report_status_by_desc("Draft")
        if not draft_status:
            raise DataNotFoundException("Draft status not found.")

        # Create the new supplemental compliance report
        new_report = ComplianceReport(
            compliance_period_id=current_report.compliance_period_id,
            legacy_id=legacy_id,
            organization_id=current_report.organization_id,
            current_status_id=draft_status.compliance_report_status_id,
            reporting_frequency=current_report.reporting_frequency,
            compliance_report_group_uuid=group_uuid,  # Use the same group_uuid
            version=new_version,  # Increment the version
            supplemental_initiator=SupplementalInitiatorType.SUPPLIER_SUPPLEMENTAL,
            nickname=f"Supplemental report {new_version}",
            summary=ComplianceReportSummary(),  # Create an empty summary object
        )

        # Add the new supplemental report
        new_report = await self.repo.create_compliance_report(new_report)

        # Snapshot the Organization Details
        await self.snapshot_services.create_organization_snapshot(
            new_report.compliance_report_id, current_report.organization_id
        )

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

        if bceid_user and reports:
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
        self, report_id: int, apply_masking: bool = False, get_chain: bool = False
    ):
        """Fetches a specific compliance report by ID."""
        report = await self.repo.get_compliance_report_by_id(report_id)
        if report is None:
            raise DataNotFoundException("Compliance report not found.")

        validated_report = ComplianceReportBaseSchema.model_validate(report)
        masked_report = (
            self._mask_report_status([validated_report])[0]
            if apply_masking
            else validated_report
        )

        history_masked_report = self._mask_report_status_for_history(
            masked_report, apply_masking
        )

        if get_chain:
            compliance_report_chain = await self.repo.get_compliance_report_chain(
                report.compliance_report_group_uuid
            )

            if apply_masking:
                # Apply masking to each report in the chain
                masked_chain = self._mask_report_status(compliance_report_chain)
                # Apply history masking to each report in the chain
                masked_chain = [
                    self._mask_report_status_for_history(report, apply_masking)
                    for report in masked_chain
                ]
                compliance_report_chain = masked_chain

            return {
                "report": history_masked_report,
                "chain": compliance_report_chain,
            }

        return history_masked_report

    def _mask_report_status_for_history(
        self, report: ComplianceReportBaseSchema, apply_masking: bool = False
    ) -> ComplianceReportBaseSchema:
        recommended_statuses = {
            ComplianceReportStatusEnum.Recommended_by_analyst.value,
            ComplianceReportStatusEnum.Recommended_by_manager.value,
        }
        if (
            apply_masking
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
