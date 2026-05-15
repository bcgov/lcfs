from typing import Any, List

from lcfs.db.models.compliance.ComplianceReport import ReportingFrequency
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.compliance_report.schema import (
    FUEL_SUPPLY_COLUMNS,
    FUEL_SUPPLY_QUARTERLY_COLUMNS,
    FUEL_SUPPLY_SHEET,
)
from lcfs.web.api.compliance_report.summary_service import (
    ComplianceReportSummaryService,
)
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository

from .base import TabularSheetExporter


class FuelSupplySheetExporter(TabularSheetExporter):
    sheet_name = FUEL_SUPPLY_SHEET
    annual_columns = FUEL_SUPPLY_COLUMNS
    quarterly_columns = FUEL_SUPPLY_QUARTERLY_COLUMNS

    def __init__(
        self,
        fs_repo: FuelSupplyRepository,
        cr_repo: ComplianceReportRepository,
        summary_service: ComplianceReportSummaryService,
    ) -> None:
        self.fs_repo = fs_repo
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
        data = await self.fs_repo.get_effective_fuel_supplies(uuid, cid, version)
        report = await self.cr_repo.get_compliance_report_by_id(report_id=cid)
        compliance_year = int(report.compliance_period.description)
        columns = self.get_columns(is_quarterly)
        headers = [col.label for col in columns]

        rows = []
        for fs in data:
            is_canada_produced_value = None
            if compliance_year >= 2025:
                is_canada_produced_value = "Yes" if fs.is_canada_produced else ""

            is_q1_supplied_value = None
            if compliance_year == 2025:
                is_q1_supplied_value = "Yes" if fs.is_q1_supplied else ""

            if is_quarterly:
                total_quantity = (
                    (fs.q1_quantity or 0)
                    + (fs.q2_quantity or 0)
                    + (fs.q3_quantity or 0)
                    + (fs.q4_quantity or 0)
                )
                rows.append(
                    [
                        round(fs.compliance_units)
                        if fs.compliance_units is not None
                        else None,
                        fs.fuel_type.fuel_type if fs.fuel_type else None,
                        fs.fuel_category.category if fs.fuel_category else None,
                        fs.end_use_type.type if fs.end_use_type else None,
                        (
                            fs.provision_of_the_act.name
                            if fs.provision_of_the_act
                            else None
                        ),
                        fs.fuel_code.fuel_code if fs.fuel_code else None,
                        is_canada_produced_value,
                        is_q1_supplied_value,
                        fs.q1_quantity,
                        fs.q2_quantity,
                        fs.q3_quantity,
                        fs.q4_quantity,
                        total_quantity if total_quantity > 0 else None,
                        fs.units.value if fs.units else None,
                        fs.target_ci,
                        fs.ci_of_fuel,
                        fs.uci,
                        fs.energy_density,
                        fs.eer,
                        fs.energy,
                    ]
                )
            else:
                rows.append(
                    [
                        round(fs.compliance_units)
                        if fs.compliance_units is not None
                        else None,
                        fs.fuel_type.fuel_type if fs.fuel_type else None,
                        fs.fuel_category.category if fs.fuel_category else None,
                        fs.end_use_type.type if fs.end_use_type else None,
                        (
                            fs.provision_of_the_act.name
                            if fs.provision_of_the_act
                            else None
                        ),
                        fs.fuel_code.fuel_code if fs.fuel_code else None,
                        is_canada_produced_value,
                        is_q1_supplied_value,
                        fs.quantity,
                        fs.units.value if fs.units else None,
                        fs.target_ci,
                        fs.ci_of_fuel,
                        fs.uci,
                        fs.energy_density,
                        fs.eer,
                        fs.energy,
                    ]
                )

        total_compliance_units = (
            await self.summary_service.calculate_fuel_supply_compliance_units(report)
        )
        empty_row = [None] * len(headers)
        total_row = [total_compliance_units, "Total"] + [None] * (len(headers) - 2)
        return self._filter_2025_only_columns(
            headers, rows, empty_row, total_row, compliance_year
        )

    def _filter_2025_only_columns(
        self, headers, rows, empty_row, total_row, compliance_year
    ) -> List[List[Any]]:
        if compliance_year >= 2025:
            return [headers] + rows + [empty_row, total_row]

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
        filtered_empty_row = [
            value for i, value in enumerate(empty_row) if i not in indices_to_remove
        ]
        filtered_total_row = [
            value for i, value in enumerate(total_row) if i not in indices_to_remove
        ]
        return [filtered_headers] + filtered_rows + [
            filtered_empty_row,
            filtered_total_row,
        ]
