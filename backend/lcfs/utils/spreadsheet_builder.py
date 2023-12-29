from io import BytesIO
import logging
import pandas as pd
from openpyxl import styles
import xlwt

class SpreadsheetBuilder:
    """
    A class to build spreadsheets in xlsx, xls, or csv format.
    Allows adding multiple sheets with custom styling and exporting them as a byte stream.

    Example:
    --------
    builder = SpreadsheetBuilder('xlsx') # xlsx, xls, csv

    # First sheet
    builder.add_sheet(
        'Employees', 
        ['Name', 'Dept'], # Columns
        [['Alex', 'HR'], ['Mike', 'IT']], # Rows
        styles={'bold_headers': True, 'column_widths': [10, 20]}
    )

    # Second sheet
    builder.add_sheet( ... )

    file_content = builder.build_spreadsheet()
    """
    def __init__(self, file_format: str = "xls"):
        self.file_format = file_format
        self.sheets_data = []

    def add_sheet(self, sheet_name: str, columns: list, rows: list, styles: dict = None):
        self.sheets_data.append({
            "sheet_name": sheet_name,
            "columns": columns,
            "rows": rows,
            "styles": styles or {}
        })

    def build_spreadsheet(self) -> bytes:
        try:
            output = BytesIO()
            if self.file_format == "xlsx":
                self._write_xlsx(output)
            elif self.file_format == "xls":
                self._write_xls(output)
            elif self.file_format == "csv":
                self._write_csv(output)
            else:
                raise ValueError(f"Unsupported file format: {self.file_format}")

            return output.getvalue()

        except Exception as e:
            logging.error("Failed to build spreadsheet: %s", e)
            raise

    def _write_xlsx(self, output):
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            for sheet in self.sheets_data:
                self._write_sheet_to_excel(writer, sheet)

    def _write_sheet_to_excel(self, writer, sheet):
        df = pd.DataFrame(sheet["rows"], columns=sheet["columns"])
        df.to_excel(writer, index=False, sheet_name=sheet["sheet_name"])

        worksheet = writer.sheets[sheet["sheet_name"]]

        # Apply number formatting for numeric columns
        for col_idx, column in enumerate(df.columns):
            if df[column].dtype in ['float', 'int']:
                for row in worksheet.iter_rows(min_row=2, max_row=worksheet.max_row, min_col=col_idx+1, max_col=col_idx+1):
                    for cell in row:
                        cell.number_format = '#,##0'
                        cell.alignment = styles.Alignment(horizontal='left')

        self._apply_excel_styling(writer, sheet)

    def _apply_excel_styling(self, writer, sheet):
        worksheet = writer.sheets[sheet["sheet_name"]]

        # Apply no border, non-bold font, and left alignment to header cells
        for cell in worksheet[1]:
            cell.border = styles.Border(
                left=styles.Side(style=None),
                right=styles.Side(style=None),
                top=styles.Side(style=None),
                bottom=styles.Side(style=None)
            )
            cell.font = styles.Font(bold=False)
            cell.alignment = styles.Alignment(horizontal='left')

        if sheet["styles"].get("bold_headers"):
            for cell in worksheet[1]:
                cell.font = styles.Font(bold=True)

        for i, width in enumerate(sheet["styles"].get("column_widths", []), start=1):
            worksheet.column_dimensions[chr(64 + i)].width = width

    def _write_xls(self, output):
        book = xlwt.Workbook()

        for sheet_data in self.sheets_data:
            self._write_sheet_to_xls(book, sheet_data)
        book.save(output)

    def _write_sheet_to_xls(self, book, sheet_data):
        sheet = book.add_sheet(sheet_data["sheet_name"])

        # Styles for headers
        bold_style = xlwt.XFStyle()
        font = xlwt.Font()
        font.bold = True
        bold_style.font = font
        default_style = xlwt.XFStyle()

        # Style for left-aligned numbers
        left_aligned_num_style = xlwt.XFStyle()
        left_aligned_num_style.num_format_str = '#,##0'
        alignment = xlwt.Alignment()
        alignment.horz = xlwt.Alignment.HORZ_LEFT
        left_aligned_num_style.alignment = alignment

        # Apply bold style for headers if required
        header_style = bold_style if sheet_data["styles"].get("bold_headers") else default_style

        for col_index, column in enumerate(sheet_data["columns"]):
            sheet.write(0, col_index, column, header_style)
            if "column_widths" in sheet_data["styles"] and len(sheet_data["styles"]["column_widths"]) > col_index:
                width = sheet_data["styles"]["column_widths"][col_index]
                sheet.col(col_index).width = 256 * width

        for row_index, row in enumerate(sheet_data["rows"], start=1):
            for col_index, value in enumerate(row):
                # Apply left-aligned style for numbers, default style for others
                cell_style = left_aligned_num_style if isinstance(value, (int, float)) else xlwt.XFStyle()
                sheet.write(row_index, col_index, value, cell_style)

    def _write_csv(self, output):
        if self.sheets_data:
            df = pd.DataFrame(self.sheets_data[0]["rows"], columns=self.sheets_data[0]["columns"])
            df.to_csv(output, index=False)
