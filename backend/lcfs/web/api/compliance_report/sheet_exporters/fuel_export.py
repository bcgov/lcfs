from typing import Any, List

from lcfs.db.models.compliance.ComplianceReport import ReportingFrequency
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.compliance_report.schema import (
    EXPORT_FUEL_COLUMNS,
    EXPORT_FUEL_SHEET,
)
from lcfs.web.api.compliance_report.summary_service import (
    ComplianceReportSummaryService,
)
from lcfs.web.api.fuel_export.repo import FuelExportRepository

from .base import TabularSheetExporter


class FuelExportSheetExporter(TabularSheetExporter):
    sheet_name = EXPORT_FUEL_SHEET
    annual_columns = EXPORT_FUEL_COLUMNS
    quarterly_columns = EXPORT_FUEL_COLUMNS
    min_compliance_year = 2024

    def __init__(
        self,
        ef_repo: FuelExportRepository,
        cr_repo: ComplianceReportRepository,
        summary_service: ComplianceReportSummaryService,
    ) -> None:
        self.ef_repo = ef_repo
        self.cr_repo = cr_repo
        self.summary_service = summary_service

    async def load_data(self, report, is_government: bool = True) -> List[List[Any]]:
        return await self.load_legacy(
            report.compliance_report_group_uuid,
            report.compliance_report_id,
            report.version,
            report.reporting_frequency == ReportingFrequency.QUARTERLY,
        )

    async def load_legacy(self, uuid, cid, version, is_quarterly) -> List[List[Any]]:
        data = await self.ef_repo.get_effective_fuel_exports(uuid, cid)
        headers = [col.label for col in EXPORT_FUEL_COLUMNS]
        rows = []
        for ef in data:
            rows.append(
                [
                    round(ef.compliance_units)
                    if ef.compliance_units is not None
                    else None,
                    ef.fuel_type.fuel_type if ef.fuel_type else None,
                    ef.fuel_category.category if ef.fuel_category else None,
                    ef.end_use_type.type if ef.end_use_type else None,
                    ef.provision_of_the_act.name if ef.provision_of_the_act else None,
                    ef.fuel_code.fuel_code if ef.fuel_code else None,
                    self._format_date(ef.export_date),
                    ef.quantity,
                    ef.units.value if ef.units else None,
                    ef.target_ci,
                    ef.ci_of_fuel,
                    ef.uci,
                    ef.energy_density,
                    ef.eer,
                    ef.energy,
                ]
            )

        report = await self.cr_repo.get_compliance_report_by_id(report_id=cid)
        total_compliance_units = (
            await self.summary_service.calculate_fuel_export_compliance_units(report)
        )
        empty_row = [None] * len(headers)
        total_row = [total_compliance_units, "Total"] + [None] * (len(headers) - 2)
        return [headers] + rows + [empty_row, total_row]
