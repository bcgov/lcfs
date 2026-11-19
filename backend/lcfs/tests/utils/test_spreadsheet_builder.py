import csv
from datetime import date
from io import BytesIO, StringIO

from openpyxl import load_workbook

import xlrd

from lcfs.utils.spreadsheet_builder import SpreadsheetBuilder, SpreadsheetColumn
from lcfs.utils.spreadsheet_sanitizer import sanitize_spreadsheet_value


def test_sanitizes_formula_prefixes_and_preserves_other_values():
    for prefix in ("=", "+", "-", "@", "\t", "\r"):
        assert sanitize_spreadsheet_value(f"{prefix}SUM(A1:A2)") == (
            f"'{prefix}SUM(A1:A2)"
        )
    assert sanitize_spreadsheet_value(" ordinary") == " ordinary"
    assert sanitize_spreadsheet_value("  =SUM(A1:A2)") == "'  =SUM(A1:A2)"
    assert sanitize_spreadsheet_value(12) == 12


def test_xlsx_writer_sanitizes_data_and_raw_sheets_but_keeps_column_formulas():
    from lcfs.utils.spreadsheet_builder import RawSpreadsheet

    builder = SpreadsheetBuilder(file_format="xlsx")
    builder.add_sheet(
        "Data",
        [
            SpreadsheetColumn("=Input", "text"),
            SpreadsheetColumn("Calculated", "text"),
            SpreadsheetColumn("Identifier", "text"),
            SpreadsheetColumn("Whitespace formula", "text"),
        ],
        [["=1+1", None, "-001", "  =1+1"]],
        column_formulas={2: "=A{row}"},
        formula_end_row=2,
    )
    builder.add_raw_sheet(
        RawSpreadsheet("Raw", [["@Input"], ["+1+1"]], [[{}], [{}]])
    )

    workbook = load_workbook(BytesIO(builder.build_spreadsheet()), data_only=False)
    assert workbook["Data"]["A1"].value == "=Input"
    assert workbook["Data"]["A1"].data_type == "s"
    assert workbook["Data"]["A2"].value == "=1+1"
    assert workbook["Data"]["A2"].data_type == "s"
    assert workbook["Data"]["B2"].value == "=A2"
    assert workbook["Data"]["B2"].data_type == "f"
    assert workbook["Data"]["C2"].value == "-001"
    assert workbook["Data"]["C2"].data_type == "s"
    assert workbook["Data"]["D2"].value == "  =1+1"
    assert workbook["Data"]["D2"].data_type == "s"
    assert workbook["Raw"]["A2"].value == "+1+1"
    assert workbook["Raw"]["A2"].data_type == "s"
    assert workbook["Raw"]["A1"].value == "@Input"
    assert workbook["Raw"]["A1"].data_type == "s"


def test_xls_and_csv_writers_sanitize_values():
    builder = SpreadsheetBuilder(file_format="xls")
    builder.add_sheet(
        "Data", [SpreadsheetColumn("+Header", "text")], [["@SUM(A1:A2)"]]
    )
    workbook = xlrd.open_workbook(file_contents=builder.build_spreadsheet())
    xls_cell = workbook.sheet_by_name("Data").cell(1, 0)
    assert xls_cell.value == "@SUM(A1:A2)"
    assert xls_cell.ctype == xlrd.XL_CELL_TEXT
    assert workbook.sheet_by_name("Data").cell(0, 0).value == "+Header"

    builder = SpreadsheetBuilder(file_format="csv")
    builder.add_sheet(
        "Data", [SpreadsheetColumn("\rHeader", "text")], [["  =1+1"]]
    )
    rows = list(csv.reader(StringIO(builder.build_spreadsheet().decode("utf-8"))))
    assert rows == [["'\rHeader"], ["'  =1+1"]]


def test_xls_writer_formats_native_date_cells():
    builder = SpreadsheetBuilder(file_format="xls")
    builder.add_sheet(
        sheet_name="Dates",
        columns=[
            SpreadsheetColumn("Transaction date", "date"),
            SpreadsheetColumn("Description", "text"),
        ],
        rows=[[date(2026, 9, 17), "Transfer"]],
    )

    workbook = xlrd.open_workbook(
        file_contents=builder.build_spreadsheet(),
        formatting_info=True,
    )
    sheet = workbook.sheet_by_name("Dates")

    date_cell = sheet.cell(1, 0)
    xf = workbook.xf_list[date_cell.xf_index]
    format_key = xf.format_key

    assert date_cell.ctype == xlrd.XL_CELL_DATE
    assert workbook.format_map[format_key].format_str.lower() == "yyyy-mm-dd"
    assert xlrd.xldate_as_datetime(date_cell.value, workbook.datemode).date() == date(
        2026, 9, 17
    )
