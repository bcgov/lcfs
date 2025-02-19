from io import BytesIO
from typing import Literal, TypedDict, List, Dict, Any

import structlog
import pandas as pd
from openpyxl import styles
from openpyxl.utils import get_column_letter
import xlwt
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.worksheet import Worksheet

logger = structlog.get_logger(__name__)
MAX_XLS_WIDTH = 65535


class SpreadsheetColumn:
    def __init__(
        self,
        label: str,
        column_type: Literal["float", "int", "text", "date", "decimal6"],
    ):
        self.label = label
        self.column_type = column_type


class SheetData(TypedDict):
    sheet_name: str
    columns: List[SpreadsheetColumn]
    rows: List[Any]
    styles: Dict[str, Any]
    validators: List[DataValidation]


class SpreadsheetBuilder:
    """
    A class to build spreadsheets in xlsx, xls, or csv format.
    Allows adding multiple sheets with custom styling and exporting them as a byte stream.

    Note: Only the first sheet data is used for the CSV format,
          as CSV files do not support multiple sheets.

    Example:
    --------
    builder = SpreadsheetBuilder('xlsx') # xlsx, xls, csv

    # First sheet
    builder.add_sheet(
        'Employees',
        ['Name', 'Dept'], # Columns
        [['Alex', 'HR'], ['Mike', 'IT']], # Rows
        styles={'bold_headers': True}
    )

    # Second sheet
    builder.add_sheet( ... )

    file_content = builder.build_spreadsheet()
    """

    def __init__(self, file_format: str = "xls"):
        if file_format not in ["xlsx", "xls", "csv"]:
            raise ValueError(f"Unsupported file format: {file_format}")

        self.file_format = file_format
        self.sheets_data: List[SheetData] = []

    def add_sheet(
        self,
        sheet_name: str,
        columns: list[SpreadsheetColumn],
        rows: list,
        styles: dict = None,
        validators: list[DataValidation] = [],
        position=0,
    ):
        self.sheets_data.insert(
            position,
            {
                "sheet_name": sheet_name,
                "columns": columns,
                "rows": rows,
                "styles": styles or {},
                "validators": validators,
            },
        )

    def build_spreadsheet(self) -> bytes:
        try:
            output = BytesIO()
            if self.file_format == "xlsx":
                self._write_xlsx(output)
            elif self.file_format == "xls":
                self._write_xls(output)
            elif self.file_format == "csv":
                self._write_csv(output)

            output.seek(0)
            return output.getvalue()

        except Exception as e:
            logger.error("Failed to build spreadsheet", error=str(e), exc_info=e)
            raise

    def _write_xlsx(self, output):
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            for sheet in self.sheets_data:
                self._write_sheet_to_excel(writer, sheet)

                # Auto-adjusting column widths
                self._auto_adjust_column_width_xlsx(writer, sheet)

    def _write_sheet_to_excel(self, writer, sheet: SheetData):
        columns = [column.label for column in sheet["columns"]]

        df = pd.DataFrame(sheet["rows"], columns=columns)
        df.to_excel(writer, index=False, sheet_name=sheet["sheet_name"])
        worksheet: Worksheet = writer.sheets[sheet["sheet_name"]]

        for data_validator in sheet["validators"]:
            worksheet.add_data_validation(data_validator)

        # Apply number formatting based on column type
        for col_idx, column in enumerate(sheet["columns"]):
            # Iterate over each cell in the current column, starting from row 2
            for row in worksheet.iter_rows(
                min_row=2,
                max_row=10000,  # Apply formatting to the first 10,000 rows even if they don't have data
                min_col=col_idx + 1,
                max_col=col_idx + 1,
            ):
                for cell in row:
                    cell.alignment = styles.Alignment(horizontal="left")
                    if column.column_type == "int":
                        cell.number_format = "#,##0"
                        cell.alignment = styles.Alignment(horizontal="right")
                    elif column.column_type == "float":
                        cell.number_format = "#,##0.00"
                        cell.alignment = styles.Alignment(horizontal="right")
                    elif column.column_type == "date":
                        cell.number_format = "yyyy-mm-dd"
                    elif column.column_type == "decimal6":
                        cell.number_format = "#,##0.00####"
                        cell.alignment = styles.Alignment(horizontal="right")

        self._apply_excel_styling(writer, sheet)

    def _apply_excel_styling(self, writer, sheet):
        worksheet = writer.sheets[sheet["sheet_name"]]

        # Apply no border, non-bold font, and left alignment to header cells
        for cell in worksheet[1]:
            cell.border = styles.Border(
                left=styles.Side(style=None),
                right=styles.Side(style=None),
                top=styles.Side(style=None),
                bottom=styles.Side(style=None),
            )
            cell.font = styles.Font(bold=False)

        if sheet["styles"].get("bold_headers"):
            for cell in worksheet[1]:
                cell.font = styles.Font(bold=True)

    def _write_xls(self, output):
        book = xlwt.Workbook()

        for sheet_data in self.sheets_data:
            self._write_sheet_to_xls(book, sheet_data)
        book.save(output)

    def _write_sheet_to_xls(self, book: xlwt.Workbook, sheet_data: SheetData):
        sheet: xlwt.Worksheet = book.add_sheet(sheet_data["sheet_name"])

        # Styles for headers
        bold_style = xlwt.XFStyle()
        font = xlwt.Font()
        font.bold = True
        bold_style.font = font
        default_style = xlwt.XFStyle()

        # Style for left-aligned numbers
        left_aligned_num_style = xlwt.XFStyle()
        left_aligned_num_style.num_format_str = "#,##0"
        alignment = xlwt.Alignment()
        alignment.horz = xlwt.Alignment.HORZ_LEFT
        left_aligned_num_style.alignment = alignment

        plain_style = xlwt.XFStyle()

        # Apply bold style for headers if required
        header_style = (
            bold_style if sheet_data["styles"].get("bold_headers") else default_style
        )

        for col_index, column in enumerate(sheet_data["columns"]):
            sheet.write(0, col_index, column.label, header_style)

        # Auto-adjusting column widths
        self._auto_adjust_column_width_xls(sheet, sheet_data)

        for row_index, row in enumerate(sheet_data["rows"], start=1):
            for col_index, value in enumerate(row):
                # Apply left-aligned style for numbers, default style for others
                cell_style = (
                    left_aligned_num_style
                    if isinstance(value, (int, float))
                    else plain_style
                )
                sheet.write(row_index, col_index, value, cell_style)

    def _auto_adjust_column_width_xlsx(self, writer: pd.ExcelWriter, sheet_data):
        worksheet = writer.sheets[sheet_data["sheet_name"]]
        for column in worksheet.columns:
            max_length = 0
            column_letter = get_column_letter(column[0].column)

            for cell in column:
                try:
                    cell_length = len(str(cell.value))
                    if cell_length > max_length:
                        max_length = cell_length
                except:
                    pass

            adjusted_width = max_length + 2  # Adding 2 for a little extra space
            worksheet.column_dimensions[column_letter].width = adjusted_width

    def _auto_adjust_column_width_xls(self, sheet, sheet_data):
        column_labels = [column.label for column in sheet_data["columns"]]

        column_widths = [
            max(len(str(cell)) for cell in column) + 2
            for column in zip(*sheet_data["rows"], column_labels)
        ]
        for i, width in enumerate(column_widths):
            sheet.col(i).width = min(256 * width, MAX_XLS_WIDTH)

    def _write_csv(self, output):
        if self.sheets_data:
            column_labels = [column.label for column in self.sheets_data[0]["columns"]]

            df = pd.DataFrame(self.sheets_data[0]["rows"], columns=column_labels)
            df.to_csv(output, index=False)
