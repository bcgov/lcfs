import { CopyRowCellRenderer } from './CopyRowCellRenderer'

export const createCopyRowActionColumn = (
  t,
  { copyValueGetters = {}, excludedColumns = [] } = {}
) => ({
  colId: 'copyRowAction',
  headerName: t('common:action', 'Action'),
  cellRenderer: CopyRowCellRenderer,
  // Pass custom extractors for renderer values and exclude non-data columns
  // when this factory is reused by another grid.
  cellRendererParams: { copyValueGetters, excludedColumns },
  width: 90,
  minWidth: 90,
  maxWidth: 90,
  sortable: false,
  filter: false,
  resizable: false,
  suppressHeaderMenuButton: true,
  suppressColumnsToolPanel: true,
  cellClass: 'vertical-middle'
})
