from logging import getLogger
import math
from typing import List
from fastapi import Depends, Request

from lcfs.db.models.compliance.ComplianceReport import ComplianceReport
from lcfs.web.api.base import PaginationResponseSchema
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.compliance_report.schema import (
    CompliancePeriodSchema,
    ComplianceReportBaseSchema,
    ComplianceReportCreateSchema,
    ComplianceReportListSchema,
    OtherUsesSchema,
    OtherUsesBaseSchema
)
from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import DataNotFoundException
from lcfs.db.models.compliance.OtherUses import OtherUses

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
                status=draft_status,
            )
        )
        # Add a new compliance history record for the new draft report
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
    async def create_fuel_for_other_uses(self, data: OtherUsesBaseSchema) -> OtherUses:
        fuel_for_other_uses = OtherUses(**data.model_dump())

        return await self.repo.create_fuel_for_ther_uses(fuel_for_other_uses)

    @service_handler
    async def update_fuel_for_other_uses(
        self,
        other_uses_id: int,
        data: OtherUsesBaseSchema
    ) -> OtherUses:
        fuel_for_other_uses = await self.repo.get_fuel_for_other_uses(other_uses_id)

        for field, value in data.dict().items():
            setattr(fuel_for_other_uses, field, value)

        return await self.repo.update_fuel_for_other_uses(fuel_for_other_uses)

    @service_handler
    async def delete_fuel_for_other_uses(
        self,
        other_uses_id: int
    ):
        return await self.repo.delete_fuel_for_other_uses(other_uses_id)
