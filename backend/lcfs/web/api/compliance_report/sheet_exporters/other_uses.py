from typing import Any, List

from lcfs.db.models.compliance.ComplianceReport import ReportingFrequency
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.compliance_report.schema import (
    OTHER_USES_COLUMNS,
    OTHER_USES_SHEET,
)
from lcfs.web.api.other_uses.repo import OtherUsesRepository
from lcfs.web.api.other_uses.schema import OtherUsesSchema

from .base import TabularSheetExporter


class OtherUsesSheetExporter(TabularSheetExporter):
    sheet_name = OTHER_USES_SHEET
    annual_columns = OTHER_USES_COLUMNS
    quarterly_columns = OTHER_USES_COLUMNS

    def __init__(
        self,
        ou_repo: OtherUsesRepository,
        cr_repo: ComplianceReportRepository,
    ) -> None:
        self.ou_repo = ou_repo
        self.cr_repo = cr_repo

    async def load_data(self, report, is_government: bool = True) -> List[List[Any]]:
        return await self.load_legacy(
            report.compliance_report_group_uuid,
            report.compliance_report_id,
            report.version,
            report.reporting_frequency == ReportingFrequency.QUARTERLY,
        )

    async def load_legacy(self, uuid, cid, version, is_quarterly) -> List[List[Any]]:
        data: List[OtherUsesSchema] = await self.ou_repo.get_effective_other_uses(
            uuid, cid
        )
        report = await self.cr_repo.get_compliance_report_by_id(report_id=cid)
        compliance_year = int(report.compliance_period.description)
        headers = [col.label for col in OTHER_USES_COLUMNS]

        rows = []
        for ou in data:
            is_canada_produced_value = None
            if compliance_year >= 2025:
                is_canada_produced_value = "Yes" if ou.is_canada_produced else ""

            is_q1_supplied_value = None
            if compliance_year == 2025:
                is_q1_supplied_value = "Yes" if ou.is_q1_supplied else ""

            rows.append(
                [
                    ou.fuel_type,
                    ou.fuel_category,
                    ou.provision_of_the_act,
                    ou.fuel_code,
                    is_canada_produced_value,
                    is_q1_supplied_value,
                    ou.quantity_supplied,
                    ou.units,
                    ou.ci_of_fuel,
                    ou.expected_use,
                    ou.rationale,
                ]
            )

        if compliance_year >= 2025:
            return [headers] + rows

        indices_to_remove = []
        if "Fuel produced in Canada" in headers:
            indices_to_remove.append(headers.index("Fuel produced in Canada"))
        if "Supplied in Q1" in headers:
            indices_to_remove.append(headers.index("Supplied in Q1"))

        filtered_headers = [
            header for i, header in enumerate(headers) if i not in indices_to_remove
        ]
        filtered_rows = [
            [value for i, value in enumerate(row) if i not in indices_to_remove]
            for row in rows
        ]
        return [filtered_headers] + filtered_rows
