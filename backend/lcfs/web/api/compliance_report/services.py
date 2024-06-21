from logging import getLogger
import math
from typing import List
from fastapi import Depends, Request

from lcfs.db.models.compliance import FinalSupplyEquipment
from lcfs.db.models.compliance.ComplianceReport import ComplianceReport
from lcfs.web.api.base import PaginationResponseSchema
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.compliance_report.schema import (
    CompliancePeriodSchema,
    ComplianceReportBaseSchema,
    ComplianceReportCreateSchema,
    ComplianceReportListSchema,
    FinalSupplyEquipmentSchema,
    FuelMeasurementTypeSchema,
    LevelOfEquipmentSchema,
)
from lcfs.web.api.fuel_code.schema import EndUseTypeSchema
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
    async def get_fse_options(self):
        """Fetches all FSE options."""
        intended_use_types = await self.repo.get_intended_use_types()
        levels_of_equipment = await self.repo.get_levels_of_equipment()
        fuel_measurement_types = await self.repo.get_fuel_measurement_types()

        return {
            "intended_use_types": [
                EndUseTypeSchema.model_validate(intended_use_type)
                for intended_use_type in intended_use_types
            ],
            "levels_of_equipment": [
                LevelOfEquipmentSchema.model_validate(level_of_equipment)
                for level_of_equipment in levels_of_equipment
            ],
            "fuel_measurement_types": [
                FuelMeasurementTypeSchema.model_validate(fuel_measurement_type)
                for fuel_measurement_type in fuel_measurement_types
            ],
        }

    async def convert_to_fse_model(
        self, fse: FinalSupplyEquipmentSchema, report_id: int
    ):
        fse_model = FinalSupplyEquipment(
            **fse.model_dump(
                exclude={
                    "id",
                    "level_of_equipment",
                    "fuel_measurement_type",
                    "intended_use",
                }
            )
        )
        fse_model.level_of_equipment = await self.repo.get_level_of_equipment_by_name(
            fse.level_of_equipment
        )
        fse_model.fuel_measurement_type = (
            await self.repo.get_fuel_measurement_type_by_name(
                fse.fuel_measurement_type
            )
        )
        fse_model.intended_use = await self.repo.get_intended_use_by_name(
            fse.intended_use
        )
        fse_model.compliance_report_id = report_id
        return fse_model

    @service_handler
    async def save_fse_list(
        self, report_id: int, fse_list: List[FinalSupplyEquipmentSchema]
    ) -> None:
        """
        Save the list of FSEs for a given report.
        """
        logger.info(f"Saving FSE list for report {report_id}")
        fse_models = []
        for fse in fse_list:
            fse_models.append(await self.convert_to_fse_model(fse, report_id))

        if len(fse_models) > 0:
            return await self.repo.add_fse_list(fse_models)
