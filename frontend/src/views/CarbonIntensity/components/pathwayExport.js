import * as XLSX from 'xlsx'

const getExportCellValue = (row, colDef) => {
  if (typeof colDef.valueGetter === 'function') {
    return colDef.valueGetter({ data: row, colDef }) ?? ''
  }
  return row?.[colDef.field] ?? ''
}

const MAX_COLUMN_WIDTH = 80
const MIN_COLUMN_WIDTH = 14
const COLUMN_PADDING = 4
const EXCEL_CHARACTER_WIDTH_IN_PIXELS = 7
const EXCEL_CELL_PADDING_IN_PIXELS = 5

const minWidthFor = (colDef) =>
  colDef.minWidth
    ? Math.ceil(
        (colDef.minWidth - EXCEL_CELL_PADDING_IN_PIXELS) /
          EXCEL_CHARACTER_WIDTH_IN_PIXELS
      )
    : 0

const columnWidthFor = (values, colDef) =>
  Math.min(
    Math.max(
      ...values.map((value) => String(value ?? '').length + COLUMN_PADDING),
      MIN_COLUMN_WIDTH,
      minWidthFor(colDef)
    ),
    MAX_COLUMN_WIDTH
  )

export const exportRowsToXlsx = ({ rows, columnDefs, fileName, sheetName }) => {
  const exportColumns = columnDefs.filter(
    (colDef) => colDef.field && !colDef.hide
  )
  const headers = exportColumns.map(
    (colDef) => colDef.headerName || colDef.field
  )
  const dataRows = rows.map((row) =>
    exportColumns.map((colDef) => getExportCellValue(row, colDef))
  )
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows])

  worksheet['!cols'] = headers.map((header, index) => ({
    wch: columnWidthFor(
      [header, ...dataRows.map((row) => row[index])],
      exportColumns[index]
    )
  }))

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  XLSX.writeFile(workbook, fileName, { bookType: 'xlsx' })
}
