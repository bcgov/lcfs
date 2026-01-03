export const addFlexToColumns = (columnDefs) => {
  if (!Array.isArray(columnDefs)) {
    return { columnDefs, hasFlexColumns: false }
  }

  let hasFlexColumns = false
  const updatedDefs = columnDefs.map((col) => {
    if (col.flex != null) {
      hasFlexColumns = true
      return col
    }

    if (col.width != null) {
      return col
    }

    hasFlexColumns = true
    return { ...col, flex: 1 }
  })

  return { columnDefs: updatedDefs, hasFlexColumns }
}

export const getColumnMinWidthSum = (columnDefs, fallbackWidth = 100) => {
  if (!Array.isArray(columnDefs)) {
    return 0
  }

  return columnDefs.reduce((total, col) => {
    const baseWidth = col?.width ?? col?.minWidth ?? fallbackWidth
    return total + (Number.isFinite(baseWidth) ? baseWidth : fallbackWidth)
  }, 0)
}

export const relaxColumnMinWidths = (api, columnApi, minWidth = 50) => {
  if (!api?.getColumnDefs) return

  const currentDefs = api.getColumnDefs()
  if (!currentDefs?.length) return

  const columnState = columnApi?.getColumnState?.() || []
  const updatedDefs = currentDefs.map((col) => ({
    ...col,
    minWidth
  }))

  api.setGridOption('columnDefs', updatedDefs)

  if (columnState.length && columnApi?.applyColumnState) {
    columnApi.applyColumnState({ state: columnState, applyOrder: true })
  }
}
