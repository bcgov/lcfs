from typing import Any, List

from lcfs.db.models.compliance.ComplianceReport import ReportingFrequency
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.compliance_report.schema import (
    FSE_EXPORT_COLUMNS,
    FSE_EXPORT_SHEET,
)
from lcfs.web.api.final_supply_equipment.repo import FinalSupplyEquipmentRepository

from .base import TabularSheetExporter


class FSESheetExporter(TabularSheetExporter):
    sheet_name = FSE_EXPORT_SHEET
    annual_columns = FSE_EXPORT_COLUMNS
    quarterly_columns = FSE_EXPORT_COLUMNS
    min_compliance_year = 2024
    locked_columns = {1}

    def __init__(
        self,
        fse_repo: FinalSupplyEquipmentRepository,
        cr_repo: ComplianceReportRepository,
    ) -> None:
        self.fse_repo = fse_repo
        self.cr_repo = cr_repo

    async def load_data(self, report, is_government: bool = True) -> List[List[Any]]:
        return await self.load_legacy(
            report.compliance_report_id,
            report.reporting_frequency == ReportingFrequency.QUARTERLY,
            is_government,
        )

    async def load_legacy(
        self, cid, is_quarterly, is_government: bool = True
    ) -> List[List[Any]]:
        headers = [col.label for col in FSE_EXPORT_COLUMNS]
        report = await self.cr_repo.get_compliance_report_by_id(report_id=cid)
        if not report:
            return [headers]

        report_group_uuid = report.compliance_report_group_uuid if report else None
        organization_name = (
            report.organization.name if report and report.organization else None
        )
        report_organization_id = (
            getattr(report, "organization_id", None) if report else None
        )
        organization_id = (
            report_organization_id
            if isinstance(report_organization_id, int)
            else (
                report.organization.organization_id
                if report and report.organization
                else None
            )
        )
        if not organization_id:
            return [headers]

        if is_government:
            reporting_result = await self.fse_repo.get_fse_reporting_list_paginated(
                organization_id=organization_id,
                pagination=PaginationRequestSchema(
                    page=1, size=1000, filters=[], sort_orders=[]
                ),
                compliance_report_id=cid,
                mode="summary",
            )
            reporting_rows = reporting_result[0]
        else:
            reporting_rows = (
                await self.fse_repo.get_effective_fse_reporting_rows_for_export(
                    organization_id=organization_id,
                    compliance_report_id=cid,
                    compliance_report_group_uuid=report_group_uuid,
                )
            )

        rows = []
        for item in reporting_rows:
            row = dict(item._mapping) if hasattr(item, "_mapping") else dict(item)
            notes_parts = []
            compliance_notes = row.get("compliance_notes")
            equipment_notes = row.get("equipment_notes")
            if compliance_notes:
                notes_parts.append(compliance_notes)
            if equipment_notes and equipment_notes not in notes_parts:
                notes_parts.append(equipment_notes)

            intended_uses = row.get("intended_uses") or []
            intended_users = row.get("intended_users") or []

            rows.append(
                [
                    row.get("status"),
                    row.get("organization_name") or organization_name,
                    row.get("allocating_organization_name"),
                    self._format_date(row.get("supply_from_date")),
                    self._format_date(row.get("supply_to_date")),
                    row.get("kwh_usage"),
                    row.get("serial_number"),
                    row.get("manufacturer"),
                    row.get("model"),
                    row.get("level_of_equipment"),
                    (
                        row.get("ports").value
                        if hasattr(row.get("ports"), "value")
                        else row.get("ports")
                    ),
                    ", ".join(intended_uses) if intended_uses else None,
                    ", ".join(intended_users) if intended_users else None,
                    row.get("street_address"),
                    row.get("city"),
                    row.get("postal_code"),
                    row.get("latitude"),
                    row.get("longitude"),
                    " | ".join(notes_parts) if notes_parts else None,
                ]
            )

        return [headers] + rows
