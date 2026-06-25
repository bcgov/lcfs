import type { AgGridReact } from '@ag-grid-community/react'
import type { ColDef, GridOptions, IRowNode } from '@ag-grid-community/core'
import type { CSSProperties, MutableRefObject, ReactNode } from 'react'

export type BCGridRow = Record<string, any>

export interface BCPaginationFilter {
  field?: string
  type?: string
  filterType?: string
  filter?: any
  values?: any[]
  operator?: string
  [key: string]: any
}

export interface BCSortOrder {
  field?: string
  direction?: string
  [key: string]: any
}

export interface BCPaginationOptions {
  page?: number
  size?: number
  total?: number
  sortOrders?: BCSortOrder[]
  filters?: BCPaginationFilter[]
  [key: string]: any
}

export interface BCGridQueryData<TData extends BCGridRow = BCGridRow> {
  data?: {
    pagination?: BCPaginationOptions
    total_count?: number
    [key: string]: TData[] | BCPaginationOptions | number | undefined | any
  }
  error?: any
  isError?: boolean
  isLoading?: boolean
  [key: string]: any
}

export type BCGridRef = MutableRefObject<AgGridReact<BCGridRow> | null>

export interface BCSaveButtonProps {
  enabled?: boolean
  text?: ReactNode
  confirmText?: ReactNode
  confirmLabel?: ReactNode
  onSave?: () => void | Promise<any>
  [key: string]: any
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
  [key: string]: any
}

export interface BCGridEditorProps<TData extends BCGridRow = BCGridRow>
  extends GridOptions<TData> {
  addMultiRow?: boolean
  alertRef?: MutableRefObject<any> | ((instance: any) => void) | null
  columnDefs?: ColDef<TData>[]
  defaultColDef?: ColDef<TData>
  enablePaste?: boolean
  getRowId?: (params: any) => string
  gridRef?: BCGridRef
  handlePaste?: (params: any) => void
  onAction?: (action: string, data?: TData, node?: IRowNode<TData>) => void
  onAddRows?: (rows: TData[]) => void
  onCellEditingStopped?: (params: any) => void
  onCellValueChanged?: (params: any) => void
  saveButtonProps?: BCSaveButtonProps
  showAddRowsButton?: boolean
  showMandatoryColumns?: boolean
  [key: string]: any
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
  alertRef?: MutableRefObject<any> | ((instance: any) => void) | null
  columnDefs?: ColDef<TData>[]
  columnState?: any[]
  dataKey?: string
  defaultColDef?: ColDef<TData>
  enableCopyButton?: boolean
  enableExportButton?: boolean
  enableFloatingPagination?: boolean
  enablePageCaching?: boolean
  enableResetButton?: boolean
  exportName?: string
  filterToolbarConfig?: Record<string, any>
  gridKey?: string
  gridRef?: BCGridRef
  loading?: boolean
  onClearFilters?: () => void
  onColumnStateChange?: (columnState: any[]) => void
  paginationPageSizeSelector?: number[]
  suppressPagination?: boolean
}
