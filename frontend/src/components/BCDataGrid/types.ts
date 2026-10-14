import type { AgGridReact } from 'ag-grid-react'
import type {
  CellEditingStoppedEvent,
  CellValueChangedEvent,
  ColDef,
  ColumnState,
  GetRowIdParams,
  GridOptions,
  RowDataTransaction
} from 'ag-grid-community'
import type { CSSProperties, MutableRefObject, ReactNode } from 'react'
import type { FloatingAlertHandle } from '@/components/BCAlert/FloatingAlert'
import type { FilterSelectConfig } from '@/components/FilterToolbar/FilterToolbar'
import type { FilterToolbarPill } from '@/components/FilterToolbar/filterUtils'

export type BCGridRow = Record<string, unknown>

export interface BCPaginationFilter {
  field?: string
  type?: string
  filterType?: string
  filter?: unknown
  values?: unknown[]
  operator?: string
  [key: string]: unknown
}

export interface BCSortOrder {
  field?: string
  direction?: string
  [key: string]: unknown
}

export interface BCPaginationOptions {
  page?: number
  size?: number
  total?: number
  sortOrders?: BCSortOrder[]
  filters?: BCPaginationFilter[]
  [key: string]: unknown
}

export interface BCGridQueryData<TData extends BCGridRow = BCGridRow> {
  data?: {
    pagination?: BCPaginationOptions
    total_count?: number
    [key: string]: TData[] | BCPaginationOptions | number | undefined | unknown
  }
  error?: unknown
  isError?: boolean
  isLoading?: boolean
  [key: string]: unknown
}

export type BCGridRef = MutableRefObject<AgGridReact<BCGridRow> | null>

export interface BCSaveButtonProps {
  enabled?: boolean
  text?: ReactNode
  confirmText?: ReactNode
  confirmLabel?: ReactNode
  onSave?: () => void | Promise<unknown>
  [key: string]: unknown
}

export interface BCGridBaseProps<TData extends BCGridRow = BCGridRow>
  extends Omit<GridOptions<TData>, 'autoSizeStrategy'> {
  autoSizeStrategy?: GridOptions<TData>['autoSizeStrategy'] | null
  autoHeight?: boolean
  className?: string
  containerStyle?: CSSProperties
  dataKey?: string
  enableMinWidthRelaxation?: boolean
  enableCellTextSelection?: boolean
  gridOptions?: GridOptions<TData>
  loading?: boolean
  onPaginationChange?: (pagination: BCPaginationOptions) => void
  paginationOptions?: BCPaginationOptions
  queryData?: BCGridQueryData<TData>
  suppressMovableColumns?: boolean
}

// Paste creates an edit context; AG Grid supplies additional event fields for
// interactive edits. Consumers can rely on the row, node, and API in both cases.
export type BCGridEditContext<TData extends BCGridRow = BCGridRow> = Pick<
  CellEditingStoppedEvent<TData>,
  'api' | 'node' | 'data'
> &
  Partial<Omit<CellEditingStoppedEvent<TData>, 'api' | 'node' | 'data'>>

export interface BCGridEditorProps<TData extends BCGridRow = BCGridRow>
  extends Omit<GridOptions<TData>, 'autoSizeStrategy'> {
  autoSizeStrategy?: GridOptions<TData>['autoSizeStrategy'] | null
  addMultiRow?: boolean
  alertRef?:
    | MutableRefObject<FloatingAlertHandle | null>
    | ((instance: FloatingAlertHandle | null) => void)
    | null
  columnDefs?: ColDef<TData>[]
  defaultColDef?: ColDef<TData>
  enablePaste?: boolean
  getRowId?: (params: GetRowIdParams<TData>) => string
  gridRef?: BCGridRef
  handlePaste?: (event: ClipboardEvent, context?: unknown) => void
  onAction?: (
    action: string,
    params?: unknown
  ) => RowDataTransaction<TData> | void | Promise<RowDataTransaction<TData> | void>
  onAddRows?: (rows: TData[]) => void
  onCellEditingStopped?: (params: BCGridEditContext<TData>) => void | Promise<unknown>
  onCellValueChanged?: (params: CellValueChangedEvent<TData>) => void
  saveButtonProps?: BCSaveButtonProps
  showAddRowsButton?: boolean
  showMandatoryColumns?: boolean
}

export interface BCGridEditorPaginatedProps<TData extends BCGridRow = BCGridRow>
  extends BCGridEditorProps<TData> {
  dataKey?: string
  enableCopyButton?: boolean
  enableExportButton?: boolean
  enableFloatingPagination?: boolean
  enablePageCaching?: boolean
  enableResetButton?: boolean
  exportName?: string
  gridKey?: string
  loading?: boolean
  onPaginationChange?: (pagination: BCPaginationOptions) => void
  paginationOptions?: BCPaginationOptions
  paginationPageSizeSelector?: number[]
  queryData?: BCGridQueryData<TData>
  suppressPagination?: boolean
}

export interface BCGridViewerProps<TData extends BCGridRow = BCGridRow>
  extends BCGridBaseProps<TData> {
  alertRef?:
    | MutableRefObject<FloatingAlertHandle | null>
    | ((instance: FloatingAlertHandle | null) => void)
    | null
  columnDefs?: ColDef<TData>[]
  columnState?: ColumnState[]
  dataKey?: string
  defaultColDef?: ColDef<TData>
  enableCopyButton?: boolean
  enableExportButton?: boolean
  enableFloatingPagination?: boolean
  enablePageCaching?: boolean
  enableResetButton?: boolean
  exportName?: string
  filterToolbarConfig?: {
    selectFilters?: FilterSelectConfig[]
    additionalPills?: FilterToolbarPill[]
  }
  gridKey?: string
  gridRef?: BCGridRef
  loading?: boolean
  onClearFilters?: () => void
  onColumnStateChange?: (columnState: ColumnState[]) => void
  paginationPageSizeSelector?: number[]
  suppressPagination?: boolean
}
