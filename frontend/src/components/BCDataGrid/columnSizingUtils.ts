import type { ColDef, GridApi } from 'ag-grid-community'

export function addFlexToColumns<TData>(columnDefs: ColDef<TData>[]): {
  columnDefs: ColDef<TData>[]
  hasFlexColumns: boolean
}
export function addFlexToColumns(columnDefs: null): {
  columnDefs: null
  hasFlexColumns: boolean
}
export function addFlexToColumns(columnDefs: undefined): {
  columnDefs: undefined
  hasFlexColumns: boolean
}
export function addFlexToColumns<TData>(
  columnDefs: ColDef<TData>[] | null | undefined
): { columnDefs: ColDef<TData>[] | null | undefined; hasFlexColumns: boolean }
export function addFlexToColumns<TValue>(columnDefs: TValue): {
  columnDefs: TValue
  hasFlexColumns: boolean
}
export function addFlexToColumns<TData>(columnDefs: unknown) {
  if (!Array.isArray(columnDefs)) {
    return { columnDefs, hasFlexColumns: false }
  }

  let hasFlexColumns = false
  const typedColumnDefs = columnDefs as ColDef<TData>[]
  const updatedDefs = typedColumnDefs.map((col) => {
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

export const getColumnMinWidthSum = <TData>(
  columnDefs: ColDef<TData>[] | null | undefined,
  fallbackWidth = 100
) => {
  if (!Array.isArray(columnDefs)) {
    return 0
  }

  return columnDefs.reduce((total, col) => {
    const baseWidth = col?.width ?? col?.minWidth ?? fallbackWidth
    return total + (Number.isFinite(baseWidth) ? baseWidth : fallbackWidth)
  }, 0)
}

export const relaxColumnMinWidths = <TData>(
  api:
    | Partial<
        Pick<
          GridApi<TData>,
          | 'getColumnDefs'
          | 'setGridOption'
          | 'getColumnState'
          | 'applyColumnState'
        >
      >
    | null
    | undefined,
  columnApi?: Partial<
    Pick<GridApi<TData>, 'getColumnState' | 'applyColumnState'>
  > | null,
  minWidth = 50
) => {
  if (!api?.getColumnDefs) return

  const currentDefs = api.getColumnDefs()
  if (!currentDefs?.length) return

  const stateSource = columnApi ?? api
  const columnState = stateSource?.getColumnState?.() || []
  const updatedDefs = currentDefs.map((col) => ({
    ...col,
    minWidth
  }))

  api.setGridOption!('columnDefs', updatedDefs)

  if (columnState.length && stateSource?.applyColumnState) {
    stateSource.applyColumnState({ state: columnState, applyOrder: true })
  }
}
