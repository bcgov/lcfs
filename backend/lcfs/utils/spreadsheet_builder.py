import pandas as pd
import structlog
import xlwt
from io import BytesIO
from openpyxl import styles
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.worksheet import Worksheet
from typing import Literal, TypedDict, List, Dict, Any, Optional

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


class RawSpreadsheet:
    def __init__(self, label: str, data: List[List[Any]], styles: List[List[Any]]):
        self.label = label
        self.data = data
        self.styles = styles


class SheetData(TypedDict):
    sheet_name: str
    columns: List[SpreadsheetColumn]
    rows: List[Any]
    styles: Dict[str, Any]
    validators: List[DataValidation]
    is_template: bool


class SpreadsheetBuilder:
    """
    A class to build spreadsheets in xlsx, xls, or csv format.
    Allows adding multiple sheets with custom styling and exporting them as a byte stream.
    """

    def __init__(self, file_format: str = "xls"):
        if file_format not in ["xlsx", "xls", "csv"]:
            raise ValueError(f"Unsupported file format: {file_format}")

        self.file_format = file_format
        self.sheets_data: List[SheetData] = []
        self.raw_sheets: List[RawSpreadsheet] = []

    def add_sheet(
        self,
        sheet_name: str,
        columns: List[SpreadsheetColumn],
        rows: list,
        styles: Optional[Dict] = None,
        validators: Optional[List[DataValidation]] = None,
        position: int = 0,
        is_template=False,
    ):
        # Avoid mutable default arguments by setting validators to an empty list if None.
        validators = validators or []
        self.sheets_data.insert(
            position,
            {
                "sheet_name": sheet_name,
                "columns": columns,
                "rows": rows,
                "styles": styles or {},
                "validators": validators,
                "is_template": is_template,
            },
        )
        return self

    def add_raw_sheet(self, data: RawSpreadsheet):
        self.raw_sheets.append(data)

    def build_spreadsheet(self) -> bytes:
        try:
            output = BytesIO()
            # Map file formats to the corresponding writer methods
            writer_func = {
                "xlsx": self._write_xlsx,
                "xls": self._write_xls,
                "csv": self._write_csv,
            }[self.file_format]
            writer_func(output)
            output.seek(0)
            return output.getvalue()
        except Exception as e:
            logger.error("Failed to build spreadsheet", error=str(e), exc_info=e)
            raise

    def _set_cell_format(self, cell, cell_type: Optional[str]) -> None:
        """
        Helper method to set formatting on a cell based on cell_type.
        """
        # Default alignment is left.
        cell.alignment = styles.Alignment(horizontal="left")
        if cell_type == "int":
            cell.number_format = "#,##0"
            cell.alignment = styles.Alignment(horizontal="right")
        elif cell_type == "float":
            cell.number_format = "#,##0.00"
            cell.alignment = styles.Alignment(horizontal="right")
        elif cell_type == "date":
            cell.number_format = "yyyy-mm-dd"
        elif cell_type == "decimal6":
            cell.number_format = "#,##0.00####"
            cell.alignment = styles.Alignment(horizontal="right")

    def _write_xlsx(self, output):
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            # Process standard sheets.
            for sheet in self.sheets_data:
                self._write_sheet_to_excel(writer, sheet)
                self._auto_adjust_column_width_xlsx(writer, sheet["sheet_name"])

            # Process raw sheets.
            for sheet in self.raw_sheets:
                header, *data = sheet.data
                df = pd.DataFrame(data, columns=header)
                df.to_excel(writer, index=False, sheet_name=sheet.label)
                worksheet: Worksheet = writer.sheets[sheet.label]

                # Apply formatting based on the provided styles.
                for row_idx, row in enumerate(
                    worksheet.iter_rows(max_row=len(sheet.data))
                ):
                    for col_idx, cell in enumerate(row):
                        cell_style = sheet.styles[row_idx][col_idx]
                        cell.font = cell_style.get("font")
                        cell.border = cell_style.get("border")
                        self._set_cell_format(cell, cell_style.get("type"))

                self._auto_adjust_column_width_xlsx(writer, sheet.label)

    def _write_sheet_to_excel(self, writer, sheet: SheetData):
        columns = [column.label for column in sheet["columns"]]
        df = pd.DataFrame(sheet["rows"], columns=columns)
        df.to_excel(writer, index=False, sheet_name=sheet["sheet_name"])
        worksheet: Worksheet = writer.sheets[sheet["sheet_name"]]

        # Add data validations.
        for validator in sheet["validators"]:
            worksheet.add_data_validation(validator)

        # Apply number formatting based on column type.
        for col_idx, column in enumerate(sheet["columns"]):
            max_row = 2000 if sheet["is_template"] else None
            for row in worksheet.iter_rows(
                min_row=2, max_row=max_row, min_col=col_idx + 1, max_col=col_idx + 1
            ):
                for cell in row:
                    self._set_cell_format(cell, column.column_type)

        self._apply_excel_styling(writer, sheet)

    def _apply_excel_styling(self, writer, sheet):
        worksheet = writer.sheets[sheet["sheet_name"]]
        # Reset header style: no border and non-bold font.
        for cell in worksheet[1]:
            cell.border = styles.Border(
                left=styles.Side(style=None),
                right=styles.Side(style=None),
                top=styles.Side(style=None),
                bottom=styles.Side(style=None),
            )
            cell.font = styles.Font(bold=False)

        # Bold headers if specified.
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

        # Pre-define styles for headers and cells.
        bold_style = xlwt.XFStyle()
        bold_font = xlwt.Font()
        bold_font.bold = True
        bold_style.font = bold_font

        default_style = xlwt.XFStyle()

        left_aligned_num_style = xlwt.XFStyle()
        left_aligned_num_style.num_format_str = "#,##0"
        alignment = xlwt.Alignment()
        alignment.horz = xlwt.Alignment.HORZ_LEFT
        left_aligned_num_style.alignment = alignment

        plain_style = xlwt.XFStyle()
        header_style = (
            bold_style if sheet_data["styles"].get("bold_headers") else default_style
        )

        # Write headers.
        for col_index, column in enumerate(sheet_data["columns"]):
            sheet.write(0, col_index, column.label, header_style)

        self._auto_adjust_column_width_xls(sheet, sheet_data)

        # Write rows with appropriate styles.
        for row_index, row in enumerate(sheet_data["rows"], start=1):
            for col_index, value in enumerate(row):
                cell_style = (
                    left_aligned_num_style
                    if isinstance(value, (int, float))
                    else plain_style
                )
                sheet.write(row_index, col_index, value, cell_style)

    def _auto_adjust_column_width_xlsx(self, writer: pd.ExcelWriter, sheet_name: str):
        worksheet = writer.sheets[sheet_name]
        for column in worksheet.columns:
            # Compute the maximum length among all cells in the column.
            max_length = max(
                (
                    len(str(cell.value)) if cell.value is not None else 0
                    for cell in column
                ),
                default=0,
            )
            adjusted_width = max_length + 2  # Adding extra space.
            column_letter = get_column_letter(column[0].column)
            worksheet.column_dimensions[column_letter].width = adjusted_width

    def _auto_adjust_column_width_xls(self, sheet, sheet_data):
        # Calculate the maximum width for each column using header and row values.
        for col_idx, column in enumerate(sheet_data["columns"]):
            header_length = len(str(column.label))
            cell_lengths = [
                len(str(row[col_idx]))
                for row in sheet_data["rows"]
                if len(row) > col_idx
            ]
            max_length = (
                max([header_length] + cell_lengths) if cell_lengths else header_length
            )
            sheet.col(col_idx).width = min(256 * (max_length + 2), MAX_XLS_WIDTH)

    def _write_csv(self, output):
        if self.sheets_data:
            columns = [col.label for col in self.sheets_data[0]["columns"]]
            df = pd.DataFrame(self.sheets_data[0]["rows"], columns=columns)
            df.to_csv(output, index=False)
