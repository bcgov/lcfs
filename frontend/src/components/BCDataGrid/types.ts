import type { AgGridReact } from 'ag-grid-react'
import type {
  CellEditingStoppedEvent,
  CellValueChangedEvent,
  ColDef,
  ColumnState,
  GetRowIdParams,
  GridOptions,
  IRowNode
} from 'ag-grid-community'
import type { CSSProperties, MutableRefObject, ReactNode } from 'react'
import type { FloatingAlertHandle } from '@/components/BCAlert/FloatingAlert'

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
  extends GridOptions<TData> {
  autoHeight?: boolean
  containerStyle?: CSSProperties
  dataKey?: string
  enableCellTextSelection?: boolean
  loading?: boolean
  onPaginationChange?: (pagination: BCPaginationOptions) => void
  paginationOptions?: BCPaginationOptions
  queryData?: BCGridQueryData<TData>
  suppressMovableColumns?: boolean
  [key: string]: unknown
}

export interface BCGridEditorProps<TData extends BCGridRow = BCGridRow>
  extends GridOptions<TData> {
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
  handlePaste?: (params: unknown) => void
  onAction?: (action: string, data?: TData, node?: IRowNode<TData>) => void
  onAddRows?: (rows: TData[]) => void
  onCellEditingStopped?: (params: CellEditingStoppedEvent<TData>) => void
  onCellValueChanged?: (params: CellValueChangedEvent<TData>) => void
  saveButtonProps?: BCSaveButtonProps
  showAddRowsButton?: boolean
  showMandatoryColumns?: boolean
  [key: string]: unknown
}

export interface BCGridEditorPaginatedProps<
  TData extends BCGridRow = BCGridRow
> extends BCGridEditorProps<TData> {
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
  filterToolbarConfig?: Record<string, unknown>
  gridKey?: string
  gridRef?: BCGridRef
  loading?: boolean
  onClearFilters?: () => void
  onColumnStateChange?: (columnState: ColumnState[]) => void
  paginationPageSizeSelector?: number[]
  suppressPagination?: boolean
}
