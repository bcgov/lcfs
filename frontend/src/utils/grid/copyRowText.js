export const getRowCopyText = (params) => {
  if (!params.api || !params.node) return ''

  return params.api
    .getAllDisplayedColumns()
    .filter(
      (column) =>
        column.getColId() !== 'copyRowAction' &&
        !params.excludedColumns?.includes(column.getColId())
    )
    .map((column) => {
      const colDef = column.getColDef()
      const copyValueGetter = params.copyValueGetters?.[column.getColId()]
      const value = copyValueGetter
        ? copyValueGetter({
            data: params.data,
            node: params.node,
            column,
            api: params.api
          })
        : params.api.getCellValue({
            rowNode: params.node,
            colKey: column,
            useFormatter: true
          })
      const text = value == null ? '' : String(value).trim()
      const header = colDef.headerName || column.getColId()

      return text ? `${header}: ${text}` : null
    })
    .filter(Boolean)
    .join('\n')
}
