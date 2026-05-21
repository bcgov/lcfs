from openpyxl.styles import Alignment, Font
from openpyxl.utils import get_column_letter
from openpyxl.workbook import Workbook
from openpyxl.worksheet.table import Table, TableStyleInfo

from lcfs.web.api.compliance_report.schema import (
    LOW_CARBON_SUMMARY_TITLE,
    PENALTY_SUMMARY_TITLE,
    RENEWABLE_REQUIREMENT_TITLE,
    SUMMARY_SHEET,
    TABLE_STYLE,
    ComplianceReportSummarySchema,
)

from .base import SheetExporter, SheetExporterSupport


class SummarySheetExporter(SheetExporter, SheetExporterSupport):
    sheet_name = SUMMARY_SHEET

    async def export_to_workbook(
        self,
        wb: Workbook,
        report,
        is_government: bool = True,
        summary: ComplianceReportSummarySchema | None = None,
    ) -> None:
        if summary is None:
            return

        ws = wb.create_sheet(title=SUMMARY_SHEET)
        bold = Font(bold=True)

        def append_and_bold(row):
            ws.append(row)
            for i, _ in enumerate(row):
                cell = ws.cell(row=ws.max_row, column=i + 1)
                cell.font = bold
                cell.alignment = Alignment(horizontal="center")

        ws.append(["", "", "", "", ""])
        self._add_centered_title(ws, RENEWABLE_REQUIREMENT_TITLE, 5)

        header_row = ws.max_row + 1
        append_and_bold(["Line", "Description", "Gasoline", "Diesel", "Jet"])

        for line in summary.renewable_fuel_target_summary:
            row = [
                line.line,
                line.description,
                line.gasoline,
                line.diesel,
                line.jet_fuel,
            ]
            ws.append(row)
            for col_idx, val in enumerate(row, start=1):
                cell = ws.cell(row=ws.max_row, column=col_idx)
                if line.line == 11 and col_idx > 2:
                    cell.number_format = '"$"#,##0.00'
                else:
                    self._format_cell(cell, val)

        end_row = ws.max_row
        if end_row > header_row:
            tab = Table(
                displayName="RenewableTbl",
                ref=f"A{header_row}:{get_column_letter(5)}{end_row}",
            )
            tab.tableStyleInfo = TableStyleInfo(
                name=TABLE_STYLE, showRowStripes=False, showColumnStripes=False
            )
            ws.add_table(tab)

        ws.append(["", "", ""])
        self._add_centered_title(ws, LOW_CARBON_SUMMARY_TITLE, 3)

        header_row = ws.max_row + 1
        append_and_bold(["Line", "Description", "Value"])

        for line in summary.low_carbon_fuel_target_summary:
            row = [line.line, line.description, line.value]
            ws.append(row)
            cell = ws.cell(row=ws.max_row, column=len(row))
            cell.number_format = "#,##0"
            if line.line == 21:
                cell.number_format = '"$"#,##0.00'

        end_row = ws.max_row
        if end_row > header_row:
            tab = Table(
                displayName="LowCarbonTbl",
                ref=f"A{header_row}:{get_column_letter(3)}{end_row}",
            )
            tab.tableStyleInfo = TableStyleInfo(
                name=TABLE_STYLE, showRowStripes=False, showColumnStripes=False
            )
            ws.add_table(tab)

        ws.append(["", "", ""])
        self._add_centered_title(ws, PENALTY_SUMMARY_TITLE, 3)

        header_row = ws.max_row + 1
        append_and_bold(["Line", "Description", "Total Value"])

        for line in summary.non_compliance_penalty_summary:
            row = ["", line.description, line.total_value]
            ws.append(row)
            cell = ws.cell(row=ws.max_row, column=len(row))
            cell.number_format = '"$"#,##0.00'

        end_row = ws.max_row
        if end_row > header_row:
            tab = Table(
                displayName="PenaltyTbl",
                ref=f"A{header_row}:{get_column_letter(3)}{end_row}",
            )
            tab.tableStyleInfo = TableStyleInfo(
                name=TABLE_STYLE, showRowStripes=False, showColumnStripes=False
            )
            ws.add_table(tab)

        self._auto_size_columns(ws)
