import * as XLSX from 'xlsx'

const getExportCellValue = (row, colDef) => {
  if (typeof colDef.valueGetter === 'function') {
    return colDef.valueGetter({ data: row, colDef }) ?? ''
  }
  return row?.[colDef.field] ?? ''
}

const columnWidthFor = (values) =>
  Math.min(
    Math.max(...values.map((value) => String(value ?? '').length), 12) + 2,
    80
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
    wch: columnWidthFor([header, ...dataRows.map((row) => row[index])])
  }))

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  XLSX.writeFile(workbook, fileName, { bookType: 'xlsx' })
}
