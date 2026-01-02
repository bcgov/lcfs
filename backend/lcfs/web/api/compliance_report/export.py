import asyncio
import decimal
import io
from datetime import datetime
from fastapi import Depends
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo
from starlette.responses import StreamingResponse
from typing import List, Union, Any

from lcfs.utils.constants import FILE_MEDIA_TYPE
from lcfs.db.models.compliance.ComplianceReport import ReportingFrequency
from lcfs.web.api.allocation_agreement.repo import AllocationAgreementRepository
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.compliance_report.schema import (
    SUMMARY_SHEET,
    FUEL_SUPPLY_SHEET,
    NOTIONAL_TRANSFER_SHEET,
    OTHER_USES_SHEET,
    EXPORT_FUEL_SHEET,
    ALLOCATION_AGREEMENTS_SHEET,
    FSE_EXPORT_SHEET,
    FUEL_SUPPLY_COLUMNS,
    FUEL_SUPPLY_QUARTERLY_COLUMNS,
    NOTIONAL_TRANSFER_COLUMNS,
    NOTIONAL_TRANSFER_QUARTERLY_COLUMNS,
    OTHER_USES_COLUMNS,
    EXPORT_FUEL_COLUMNS,
    ALLOCATION_AGREEMENT_COLUMNS,
    ALLOCATION_AGREEMENT_QUARTERLY_COLUMNS,
    FSE_EXPORT_COLUMNS,
    RENEWABLE_REQUIREMENT_TITLE,
    LOW_CARBON_SUMMARY_TITLE,
    PENALTY_SUMMARY_TITLE,
    TABLE_STYLE,
    SHOW_ROW_STRIPES,
    SHOW_COL_STRIPES,
    ExportColumn,
)
from lcfs.web.api.compliance_report.summary_service import (
    ComplianceReportSummaryService,
)
from lcfs.web.api.compliance_report.schema import ComplianceReportSummarySchema
from lcfs.web.api.final_supply_equipment.repo import FinalSupplyEquipmentRepository
from lcfs.web.api.fuel_export.repo import FuelExportRepository
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.api.notional_transfer.repo import NotionalTransferRepository
from lcfs.web.api.other_uses.repo import OtherUsesRepository
from lcfs.web.api.other_uses.schema import OtherUsesSchema
from lcfs.web.core.decorators import service_handler


class ComplianceReportExporter:
    def __init__(
        self,
        fse_repo: FinalSupplyEquipmentRepository = Depends(
            FinalSupplyEquipmentRepository
        ),
        fs_repo: FuelSupplyRepository = Depends(FuelSupplyRepository),
        cr_repo: ComplianceReportRepository = Depends(ComplianceReportRepository),
        nt_repo: NotionalTransferRepository = Depends(NotionalTransferRepository),
        ou_repo: OtherUsesRepository = Depends(OtherUsesRepository),
        ef_repo: FuelExportRepository = Depends(FuelExportRepository),
        aa_repo: AllocationAgreementRepository = Depends(AllocationAgreementRepository),
        summary_service: ComplianceReportSummaryService = Depends(
            ComplianceReportSummaryService
        ),
    ) -> None:
        self.summary_service = summary_service
        self.aa_repo = aa_repo
        self.ef_repo = ef_repo
        self.ou_repo = ou_repo
        self.nt_repo = nt_repo
        self.fs_repo = fs_repo
        self.cr_repo = cr_repo
        self.fse_repo = fse_repo

        # Data loader mapping
        self.data_loaders = {
            FUEL_SUPPLY_SHEET: self._load_fuel_supply_data,
            NOTIONAL_TRANSFER_SHEET: self._load_notional_transfer_data,
            OTHER_USES_SHEET: self._load_fuels_for_other_use_data,
            EXPORT_FUEL_SHEET: self._load_export_fuel_data,
            ALLOCATION_AGREEMENTS_SHEET: self._load_allocation_agreement_data,
            FSE_EXPORT_SHEET: self._load_fse_data,
        }

        # Annual column definitions mapping
        self.annual_column_definitions = {
            FUEL_SUPPLY_SHEET: FUEL_SUPPLY_COLUMNS,
            NOTIONAL_TRANSFER_SHEET: NOTIONAL_TRANSFER_COLUMNS,
            OTHER_USES_SHEET: OTHER_USES_COLUMNS,
            EXPORT_FUEL_SHEET: EXPORT_FUEL_COLUMNS,
            ALLOCATION_AGREEMENTS_SHEET: ALLOCATION_AGREEMENT_COLUMNS,
            FSE_EXPORT_SHEET: FSE_EXPORT_COLUMNS,
        }

        # Quarterly column definitions mapping
        self.quarterly_column_definitions = {
            FUEL_SUPPLY_SHEET: FUEL_SUPPLY_QUARTERLY_COLUMNS,
            NOTIONAL_TRANSFER_SHEET: NOTIONAL_TRANSFER_QUARTERLY_COLUMNS,
            OTHER_USES_SHEET: OTHER_USES_COLUMNS,  # Other uses doesn't have quarterly
            EXPORT_FUEL_SHEET: EXPORT_FUEL_COLUMNS,  # Export fuel doesn't have quarterly
            ALLOCATION_AGREEMENTS_SHEET: ALLOCATION_AGREEMENT_QUARTERLY_COLUMNS,
            FSE_EXPORT_SHEET: FSE_EXPORT_COLUMNS,  # FSE doesn't have quarterly
        }

    @service_handler
    async def export(self, compliance_report_id: int) -> StreamingResponse:
        wb = Workbook()
        wb.remove(wb.active)

        # Get report data
        report = await self.cr_repo.get_compliance_report_by_id(
            report_id=compliance_report_id
        )
        uuid = report.compliance_report_group_uuid
        cid = report.compliance_report_id
        is_quarterly = report.reporting_frequency == ReportingFrequency.QUARTERLY

        # Recalculate summary to ensure latest data and add summary sheet
        summary_schema = await self.summary_service.calculate_compliance_report_summary(
            compliance_report_id
        )
        await self._add_summary_sheet(wb, summary_schema)

        # Add all schedule data sheets - run sequentially to avoid DB connection issues
        for sheet_name, loader in self.data_loaders.items():
            if sheet_name in [FSE_EXPORT_SHEET, ALLOCATION_AGREEMENTS_SHEET]:
                data = await loader(cid, is_quarterly)
            else:
                data = await loader(uuid, cid, report.version, is_quarterly)

            row_count = len(data) - 1 if data else 0

            # Process each result
            if data:
                await self._add_sheet(wb, sheet_name, data)

        # Export to stream
        stream = io.BytesIO()
        wb.save(stream)
        stream.seek(0)

        # Generate filename - use EIR for early issuance reports, CR for annual reports
        prefix = "EIR" if is_quarterly else "CR"
        filename = f"{prefix}-{report.organization.name}-{report.compliance_period.description}-{report.current_status.status.value}.xlsx"
        headers = {"Content-Disposition": f'attachment; filename="{filename}"'}

        return StreamingResponse(
            stream, media_type=FILE_MEDIA_TYPE["XLSX"].value, headers=headers
        )

    async def _add_sheet(
        self,
        wb: Workbook,
        title: str,
        data: List[List[Union[str, int, float, datetime]]],
    ) -> None:
        """Add a data sheet to the workbook with proper formatting and table styling."""
        if not data or len(data) <= 1:  # Skip if no data found
            return

        # Create sheet with truncated name
        ws = wb.create_sheet(title=title[:31])

        headers = data[0]
        rows = data[1:]

        # Add headers
        ws.append(headers)

        # Add and format data rows
        for row_idx, row in enumerate(rows, start=2):
            ws.append(row)
            for col_idx, val in enumerate(row, start=1):
                cell = ws.cell(row=row_idx, column=col_idx)
                self._format_cell(cell, val)

        # Add excel table formatting
        self._add_table(ws, title, len(headers), len(rows))

        # Auto-size columns
        self._auto_size_columns(ws)

    def _format_cell(self, cell, value) -> None:
        """Format cell based on data type."""
        if isinstance(value, int):
            cell.number_format = "#,##0"
        elif isinstance(value, float) or isinstance(value, decimal.Decimal):
            cell.number_format = "#,##0.00##############"

    def _add_table(self, ws, title: str, cols: int, rows: int) -> None:
        """Add a styled table to the worksheet."""
        table_name = title.replace(" ", "") + "Tbl"
        table_ref = f"A1:{get_column_letter(cols)}{rows+1}"

        tab = Table(displayName=table_name, ref=table_ref)
        tab.tableStyleInfo = TableStyleInfo(
            name=TABLE_STYLE,
            showRowStripes=SHOW_ROW_STRIPES,
            showColumnStripes=SHOW_COL_STRIPES,
        )
        ws.add_table(tab)

    def _auto_size_columns(self, ws) -> None:
        """Auto-size columns based on content with improved width calculation."""
        for col in ws.columns:
            # Calculate content-based width
            max_length = max(len(str(cell.value)) if cell.value else 0 for cell in col)

            # Get header length for comparison
            header_cell = col[0]
            header_length = len(str(header_cell.value)) if header_cell.value else 0

            # Use the maximum of content length and header length
            content_width = max(max_length, header_length)

            # Set minimum width based on content type and typical requirements
            # Default minimum width for readability
            min_width = 12

            # Adjust minimum width based on header content to handle different column types
            header_text = str(header_cell.value).lower() if header_cell.value else ""

            if any(
                keyword in header_text
                for keyword in ["name", "description", "address", "organization"]
            ):
                min_width = 25  # Wide columns for text content
            elif any(
                keyword in header_text
                for keyword in ["fuel type", "fuel code", "manufacturer", "model"]
            ):
                min_width = 18  # Medium-wide for categorical data
            elif any(keyword in header_text for keyword in ["email", "phone"]):
                min_width = 20  # Contact information
            elif any(
                keyword in header_text for keyword in ["date", "serial", "registration"]
            ):
                min_width = 15  # Date and ID columns
            elif any(
                keyword in header_text
                for keyword in [
                    "quantity",
                    "units",
                    "compliance",
                    "value",
                    "ci",
                    "density",
                    "eer",
                    "energy",
                ]
            ):
                min_width = 14  # Numeric columns
            elif any(keyword in header_text for keyword in ["line"]):
                min_width = 8  # Short line number columns

            # Calculate final width with padding
            # Add extra padding for better readability (minimum 4 characters)
            padding = max(4, int(content_width * 0.1))  # 10% padding, minimum 4 chars
            calculated_width = content_width + padding

            # Apply minimum and maximum constraints
            final_width = max(min_width, calculated_width)
            # Set reasonable maximum to prevent extremely wide columns
            final_width = min(final_width, 50)

            ws.column_dimensions[get_column_letter(col[0].column)].width = final_width

    async def _add_summary_sheet(
        self, wb: Workbook, summary: ComplianceReportSummarySchema
    ) -> None:
        """Add the summary sheet with all three tables."""
        ws = wb.create_sheet(title=SUMMARY_SHEET)
        bold = Font(bold=True)

        def append_and_bold(row):
            ws.append(row)
            for i, _ in enumerate(row):
                cell = ws.cell(row=ws.max_row, column=i + 1)
                cell.font = bold
                cell.alignment = Alignment(horizontal="center")

        # Add Renewable fuel target summary
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
        tab = Table(
            displayName="RenewableTbl",
            ref=f"A{header_row}:{get_column_letter(5)}{end_row}",
        )
        tab.tableStyleInfo = TableStyleInfo(
            name=TABLE_STYLE, showRowStripes=False, showColumnStripes=False
        )
        ws.add_table(tab)

        # Add Low Carbon Fuel Target Summary
        ws.append(["", "", ""])
        self._add_centered_title(ws, LOW_CARBON_SUMMARY_TITLE, 3)

        header_row = ws.max_row + 1
        append_and_bold(["Line", "Description", "Value"])

        for line in summary.low_carbon_fuel_target_summary:
            row = [line.line, line.description, line.value]
            ws.append(row)
            last_col_idx = len(row)
            cell = ws.cell(row=ws.max_row, column=last_col_idx)
            cell.number_format = "#,##0"
            if line.line == 21:
                cell.number_format = '"$"#,##0.00'

        end_row = ws.max_row
        tab = Table(
            displayName="LowCarbonTbl",
            ref=f"A{header_row}:{get_column_letter(3)}{end_row}",
        )
        tab.tableStyleInfo = TableStyleInfo(
            name=TABLE_STYLE, showRowStripes=False, showColumnStripes=False
        )
        ws.add_table(tab)

        # Add Non-Compliance Penalty Summary
        ws.append(["", "", ""])
        self._add_centered_title(ws, PENALTY_SUMMARY_TITLE, 3)

        header_row = ws.max_row + 1
        append_and_bold(["Line", "Description", "Total Value"])

        for line in summary.non_compliance_penalty_summary:
            row = ["", line.description, line.total_value]
            ws.append(row)
            last_col_idx = len(row)
            cell = ws.cell(row=ws.max_row, column=last_col_idx)
            cell.number_format = '"$"#,##0.00'

        end_row = ws.max_row
        tab = Table(
            displayName="PenaltyTbl",
            ref=f"A{header_row}:{get_column_letter(3)}{end_row}",
        )
        tab.tableStyleInfo = TableStyleInfo(
            name=TABLE_STYLE, showRowStripes=False, showColumnStripes=False
        )
        ws.add_table(tab)
        self._auto_size_columns(ws)

    def _add_centered_title(self, ws, title: str, columns: int) -> None:
        """Add a centered merged cell title."""
        row_num = ws.max_row + 1
        ws.append([title] + [""] * (columns - 1))
        ws.merge_cells(
            start_row=row_num, start_column=1, end_row=row_num, end_column=columns
        )
        cell = ws.cell(row=row_num, column=1)
        cell.alignment = Alignment(horizontal="center")
        cell.font = Font(bold=True)

    def _format_date(self, val) -> Union[datetime, str]:
        """Format date values consistently."""
        if isinstance(val, datetime):
            return val
        if hasattr(val, "year") and hasattr(val, "month") and hasattr(val, "day"):
            try:
                return val
            except Exception:
                pass
        return str(val) if val else None

    async def _load_fuel_supply_data(
        self, uuid, cid, version, is_quarterly
    ) -> List[List[Any]]:
        """Load fuel supply data."""
        data = await self.fs_repo.get_effective_fuel_supplies(uuid, cid, version)

        # Get the compliance report to check the year
        report = await self.cr_repo.get_compliance_report_by_id(report_id=cid)
        compliance_year = int(report.compliance_period.description)

        # Choose column definitions based on reporting frequency
        columns = (
            self.quarterly_column_definitions[FUEL_SUPPLY_SHEET]
            if is_quarterly
            else self.annual_column_definitions[FUEL_SUPPLY_SHEET]
        )
        headers = [col.label for col in columns]

        rows = []
        for fs in data:
            # Format is_canada_produced field - only show for 2025+
            is_canada_produced_value = None
            if compliance_year >= 2025:
                is_canada_produced_value = "Yes" if fs.is_canada_produced else ""

            # Format is_q1_supplied field - only show for 2025 (quarterly reports)
            is_q1_supplied_value = None
            if compliance_year == 2025 and is_quarterly:
                is_q1_supplied_value = "Yes" if fs.is_q1_supplied else ""

            if is_quarterly:
                # Calculate total quantity for quarterly reports
                total_quantity = (
                    (fs.q1_quantity or 0)
                    + (fs.q2_quantity or 0)
                    + (fs.q3_quantity or 0)
                    + (fs.q4_quantity or 0)
                )
                rows.append(
                    [
                        round(fs.compliance_units) if fs.compliance_units else None,
                        fs.fuel_type.fuel_type if fs.fuel_type else None,
                        fs.fuel_type_other,
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
                # Annual report format
                rows.append(
                    [
                        round(fs.compliance_units) if fs.compliance_units else None,
                        fs.fuel_type.fuel_type if fs.fuel_type else None,
                        fs.fuel_type_other,
                        fs.fuel_category.category if fs.fuel_category else None,
                        fs.end_use_type.type if fs.end_use_type else None,
                        (
                            fs.provision_of_the_act.name
                            if fs.provision_of_the_act
                            else None
                        ),
                        fs.fuel_code.fuel_code if fs.fuel_code else None,
                        is_canada_produced_value,
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

        # Filter out columns with None values for pre-2025 reports
        if compliance_year < 2025:
            # Find indices of columns to remove
            indices_to_remove = []
            if "Fuel produced in Canada" in headers:
                indices_to_remove.append(headers.index("Fuel produced in Canada"))
            if "Supplied in Q1" in headers:
                indices_to_remove.append(headers.index("Supplied in Q1"))

            # Remove columns from headers
            filtered_headers = [
                h for i, h in enumerate(headers) if i not in indices_to_remove
            ]

            # Remove corresponding values from rows
            filtered_rows = [
                [v for i, v in enumerate(row) if i not in indices_to_remove]
                for row in rows
            ]

            return [filtered_headers] + filtered_rows

        return [headers] + rows

    async def _load_notional_transfer_data(
        self, uuid, cid, version, is_quarterly
    ) -> List[List[Any]]:
        """Load notional transfer data."""
        data = await self.nt_repo.get_effective_notional_transfers(uuid, cid)

        # Choose column definitions based on reporting frequency
        columns = (
            self.quarterly_column_definitions[NOTIONAL_TRANSFER_SHEET]
            if is_quarterly
            else self.annual_column_definitions[NOTIONAL_TRANSFER_SHEET]
        )
        headers = [col.label for col in columns]

        rows = []
        for nt in data:
            if is_quarterly:
                # Calculate total quantity for quarterly reports
                total_quantity = (
                    (nt.q1_quantity or 0)
                    + (nt.q2_quantity or 0)
                    + (nt.q3_quantity or 0)
                    + (nt.q4_quantity or 0)
                )
                rows.append(
                    [
                        nt.legal_name,
                        nt.address_for_service,
                        nt.fuel_category,
                        (
                            nt.received_or_transferred.value
                            if nt.received_or_transferred
                            else None
                        ),
                        nt.q1_quantity,
                        nt.q2_quantity,
                        nt.q3_quantity,
                        nt.q4_quantity,
                        total_quantity if total_quantity > 0 else None,
                    ]
                )
            else:
                # Annual report format
                rows.append(
                    [
                        nt.legal_name,
                        nt.address_for_service,
                        nt.fuel_category,
                        (
                            nt.received_or_transferred.value
                            if nt.received_or_transferred
                            else None
                        ),
                        nt.quantity,
                    ]
                )

        return [headers] + rows

    async def _load_fuels_for_other_use_data(
        self, uuid, cid, version, is_quarterly
    ) -> List[List[Any]]:
        """Load fuels for other use data."""
        data: List[OtherUsesSchema] = await self.ou_repo.get_effective_other_uses(
            uuid, cid
        )

        # Get the compliance report to check the year
        report = await self.cr_repo.get_compliance_report_by_id(report_id=cid)
        compliance_year = int(report.compliance_period.description)

        # Other uses doesn't have quarterly data, always use annual columns
        headers = [col.label for col in OTHER_USES_COLUMNS]

        rows = []
        for ou in data:
            # Format is_canada_produced field - only show for 2025+
            is_canada_produced_value = None
            if compliance_year >= 2025:
                is_canada_produced_value = "Yes" if ou.is_canada_produced else ""

            # Format is_q1_supplied field - only show for 2025
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

        # Filter out columns with None values for pre-2025 reports
        if compliance_year < 2025:
            # Find indices of columns to remove
            indices_to_remove = []
            if "Fuel produced in Canada" in headers:
                indices_to_remove.append(headers.index("Fuel produced in Canada"))
            if "Supplied in Q1" in headers:
                indices_to_remove.append(headers.index("Supplied in Q1"))

            # Remove columns from headers
            filtered_headers = [
                h for i, h in enumerate(headers) if i not in indices_to_remove
            ]

            # Remove corresponding values from rows
            filtered_rows = [
                [v for i, v in enumerate(row) if i not in indices_to_remove]
                for row in rows
            ]

            return [filtered_headers] + filtered_rows

        return [headers] + rows

    async def _load_export_fuel_data(
        self, uuid, cid, version, is_quarterly
    ) -> List[List[Any]]:
        """Load export fuel data."""
        data = await self.ef_repo.get_effective_fuel_exports(uuid, cid)
        # Export fuel doesn't have quarterly data, always use annual columns
        headers = [col.label for col in EXPORT_FUEL_COLUMNS]

        rows = []
        for ef in data:
            rows.append(
                [
                    round(ef.compliance_units),
                    self._format_date(ef.export_date),
                    ef.fuel_type.fuel_type if ef.fuel_type else None,
                    ef.fuel_type_other,
                    ef.fuel_category.category if ef.fuel_category else None,
                    ef.end_use_type.type if ef.end_use_type else None,
                    ef.provision_of_the_act.name if ef.provision_of_the_act else None,
                    ef.fuel_code.fuel_code if ef.fuel_code else None,
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

        return [headers] + rows

    async def _load_allocation_agreement_data(
        self, cid, is_quarterly
    ) -> List[List[Any]]:
        """Load allocation agreement data."""
        data = await self.aa_repo.get_allocation_agreements(cid)

        # Choose column definitions based on reporting frequency
        columns = (
            self.quarterly_column_definitions[ALLOCATION_AGREEMENTS_SHEET]
            if is_quarterly
            else self.annual_column_definitions[ALLOCATION_AGREEMENTS_SHEET]
        )
        headers = [col.label for col in columns]

        rows = []
        for aa in data:
            if is_quarterly:
                # Calculate total quantity for quarterly reports
                total_quantity = (
                    (aa.q1_quantity or 0)
                    + (aa.q2_quantity or 0)
                    + (aa.q3_quantity or 0)
                    + (aa.q4_quantity or 0)
                )
                rows.append(
                    [
                        aa.allocation_transaction_type,
                        aa.transaction_partner,
                        aa.postal_address,
                        aa.transaction_partner_email,
                        aa.transaction_partner_phone,
                        aa.fuel_type,
                        aa.fuel_type_other,
                        aa.fuel_category,
                        aa.provision_of_the_act,
                        aa.fuel_code,
                        aa.ci_of_fuel,
                        aa.q1_quantity,
                        aa.q2_quantity,
                        aa.q3_quantity,
                        aa.q4_quantity,
                        total_quantity if total_quantity > 0 else None,
                        aa.units,
                    ]
                )
            else:
                # Annual report format
                rows.append(
                    [
                        aa.allocation_transaction_type,
                        aa.transaction_partner,
                        aa.postal_address,
                        aa.transaction_partner_email,
                        aa.transaction_partner_phone,
                        aa.fuel_type,
                        aa.fuel_type_other,
                        aa.fuel_category,
                        aa.provision_of_the_act,
                        aa.fuel_code,
                        aa.ci_of_fuel,
                        aa.quantity,
                        aa.units,
                    ]
                )

        return [headers] + rows

    async def _load_fse_data(self, cid, is_quarterly) -> List[List[Any]]:
        """Load final supply equipment data."""
        # FSE doesn't have quarterly data, always use annual columns
        headers = [col.label for col in FSE_EXPORT_COLUMNS]
        report = await self.cr_repo.get_compliance_report_by_id(report_id=cid)
        if not report:
            return [headers]
        report_group_uuid = report.compliance_report_group_uuid if report else None
        organization_name = (
            report.organization.name if report and report.organization else None
        )
        organization_id = (
            report.organization_id
            if report and getattr(report, "organization_id", None)
            else report.organization.organization_id
            if report and report.organization
            else None
        )
        if not organization_id:
            return [headers]

        reporting_result = await self.fse_repo.get_fse_reporting_list_paginated(
            organization_id=organization_id,
            pagination=PaginationRequestSchema(
                page=1, size=1000, filters=[], sort_orders=[]
            ),
            compliance_report_group_uuid=report_group_uuid,
            mode="summary",
        )
        reporting_rows = reporting_result[0]

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
                    row.get("organization_name") or organization_name,
                    self._format_date(row.get("supply_from_date")),
                    self._format_date(row.get("supply_to_date")),
                    row.get("kwh_usage"),
                    row.get("serial_number"),
                    row.get("manufacturer"),
                    row.get("model"),
                    row.get("level_of_equipment"),
                    row.get("ports"),
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
