from datetime import date

import xlrd

from lcfs.utils.spreadsheet_builder import SpreadsheetBuilder, SpreadsheetColumn


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
