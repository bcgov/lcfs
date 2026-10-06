/* eslint-disable react-hooks/exhaustive-deps */
import DataGridLoading from '@/components/DataGridLoading'
import { AgGridReact } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-material.css'
import {
  AllCommunityModule,
  ModuleRegistry,
  provideGlobalGridOptions
} from 'ag-grid-community'
import type {
  CellClickedEvent,
  CellKeyDownEvent,
  ColDef,
  DomLayoutType,
  GridApi,
  GridReadyEvent,
  RowClickedEvent,
  RowClassParams
} from 'ag-grid-community'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react'
import { useSearchParams } from 'react-router-dom'
import type { BCGridBaseProps, BCGridRow } from './types'

export type { BCGridBaseProps } from './types'

const ROW_HEIGHT = 45
ModuleRegistry.registerModules([AllCommunityModule])
provideGlobalGridOptions({ theme: 'legacy' })

const defaultNoRowsOverlayTemplate = `
  <div
    style="
      min-height: ${ROW_HEIGHT}px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: 8px 12px;
      box-sizing: border-box;
    "
  >
    No rows found
  </div>
`

// The ref exposes the mounted grid's enumerable instance fields and our helper.
// Before the child grid attaches, those instance fields may be unavailable.
export type BCGridBaseHandle = Partial<AgGridReact<BCGridRow>> & {
  clearFilters?: () => void
}

export const BCGridBase = forwardRef<BCGridBaseHandle, BCGridBaseProps>(
  (
    {
      autoSizeStrategy,
      autoHeight,
      containerStyle,
      enableCellTextSelection,
      getRowId,
      overlayNoRowsTemplate,
      queryData,
      dataKey,
      paginationOptions,
      onPaginationChange,
      onRowClicked,
      suppressMovableColumns = true,
      ...props
    },
    forwardedRef
  ) => {
    const [searchParams] = useSearchParams()
    const highlightedId = searchParams.get('hid')
    const ref = useRef<AgGridReact<BCGridRow> | null>(null)

    const loadingOverlayComponent = useMemo(() => DataGridLoading, [])

    const getRowStyle = useCallback((params: RowClassParams<BCGridRow>) => {
      if (params.node.id === highlightedId) {
        return { backgroundColor: '#fade81' }
      }
    }, [])

    const gridApiRef = useRef<GridApi<BCGridRow> | null>(null)
    const [domLayout, setDomLayout] = useState<DomLayoutType>('autoHeight')
    const [height, setHeight] = useState('auto')

    const determineHeight = useCallback(() => {
      if (!gridApiRef.current || !autoHeight) {
        return
      }

      const maxVisibleRows = (window.innerHeight * 0.75) / ROW_HEIGHT

      const displayedRowCount = gridApiRef.current.getDisplayedRowCount()
      if (displayedRowCount <= maxVisibleRows) {
        setDomLayout('autoHeight')
        setHeight('auto')
      } else {
        setDomLayout('normal')
        setHeight('75vh')
      }
    }, [])

    const onGridReady = useCallback(
      (params: GridReadyEvent<BCGridRow>) => {
        gridApiRef.current = params.api
        determineHeight()
        if (props.onGridReady && typeof props.onGridReady === 'function') {
          props.onGridReady(params)
        }
      },
      [determineHeight]
    )

    useEffect(() => {
      const handleResize = () => {
        determineHeight()
      }

      window.addEventListener('resize', handleResize)
      return () => {
        window.removeEventListener('resize', handleResize)
      }
    }, [determineHeight])

    const clearFilters = useCallback(() => {
      const api = ref.current?.api
      if (api) {
        // Clear filter model
        api.setFilterModel(null)

        // Clear individual filters
        const columns = api.getColumnDefs() as unknown as ColDef<BCGridRow>[]
        columns.forEach((column) => {
          api.destroyFilter(column.field as string)
        })
      }
    }, [])

    // Handle keyboard events for row navigation
    const onCellKeyDown = useCallback(
      (params: CellKeyDownEvent<BCGridRow>) => {
        const e = params.event as KeyboardEvent | null | undefined
        if (!e) return

        if (e.code === 'Enter' && params.node) {
          const target = e.target
          const cellEl =
            target instanceof Element ? target.closest('.ag-cell') : null
          if (!cellEl) return

          // Look for links in the cell - check both direct children and nested elements
          // React Router's Link component renders as an <a> tag
          const link = cellEl.querySelector(
            'a[href], a[data-discover="true"]'
          ) as HTMLAnchorElement | null
          if (link) {
            e.preventDefault()
            e.stopPropagation()
            link.click()
            return
          }

          // Check for buttons that might be in the cell
          const button = cellEl.querySelector(
            'button:not([disabled])'
          ) as HTMLButtonElement | null
          if (button) {
            e.preventDefault()
            e.stopPropagation()
            button.click()
            return
          }

          // If no interactive elements found, trigger row click if handler is provided
          if (onRowClicked) {
            e.preventDefault()
            e.stopPropagation()
            onRowClicked({ ...params, event: e })
            return
          }
        }

        if (props.onCellKeyDown) {
          props.onCellKeyDown(params)
        }
      },
      [props.onCellKeyDown, onRowClicked]
    )

    // Helper to check if a column is a checkbox selection column
    const isCheckboxColumn = useCallback(
      (params: CellClickedEvent<BCGridRow> | RowClickedEvent<BCGridRow>) => {
        const column = 'column' in params ? params.column : undefined
        const colId = column?.getColId?.()
        const colDef = column?.getColDef?.()

        // Check various possible selection column identifiers
        if (
          colId === '__select__' ||
          colId === 'ag-Grid-SelectionColumn' ||
          colId === 'ag-Grid-AutoColumn' ||
          colDef?.checkboxSelection ||
          colDef?.showDisabledCheckboxes !== undefined ||
          // AG Grid's built-in selection column has no field and headerName
          (colDef &&
            !colDef.field &&
            !colDef.headerName &&
            colId?.startsWith?.('ag-Grid'))
        ) {
          return true
        }

        // Fallback: check if the clicked cell contains a checkbox (DOM-based check)
        const target = params.event?.target
        const cellElement =
          target instanceof Element ? target.closest('.ag-cell') : null
        if (cellElement) {
          // Check for checkbox input or AG Grid's selection wrapper
          const hasCheckbox = cellElement.querySelector(
            'input[type="checkbox"]'
          )
          const hasSelectionWrapper = cellElement.querySelector(
            '.ag-selection-checkbox'
          )
          if (hasCheckbox || hasSelectionWrapper) {
            return true
          }
        }

        // Also check if we clicked directly on the selection checkbox wrapper
        if (
          target instanceof Element &&
          target.closest('.ag-selection-checkbox')
        ) {
          return true
        }

        return false
      },
      []
    )

    // Handle cell clicks to expand checkbox click target area
    // Clicking anywhere in the checkbox cell will toggle the row selection
    const onCellClicked = useCallback(
      (params: CellClickedEvent<BCGridRow>) => {
        if (isCheckboxColumn(params) && params.node) {
          // Check if the row is selectable
          const isRowSelectable = params.node.selectable !== false

          if (isRowSelectable) {
            // Check if clicking directly on the checkbox input - if so, AG Grid handles it
            const target = params.event?.target
            if (
              target instanceof HTMLInputElement &&
              target.type === 'checkbox'
            ) {
              return // Let AG Grid handle the direct checkbox click
            }

            // Toggle selection for clicks anywhere else in the cell
            params.node.setSelected(!params.node.isSelected())
          }
          // Don't call parent's onCellClicked for checkbox column - prevents navigation
          return
        }

        // Call any existing onCellClicked handler for non-checkbox columns
        if (props.onCellClicked) {
          props.onCellClicked(params)
        }
      },
      [props.onCellClicked, isCheckboxColumn]
    )

    // Wrap onRowClicked to prevent navigation when clicking on checkbox cells
    const handleRowClicked = useCallback(
      (params: RowClickedEvent<BCGridRow>) => {
        // Don't trigger row click handler for checkbox column clicks
        if (isCheckboxColumn(params)) {
          return
        }

        // Call the original onRowClicked handler
        if (onRowClicked) {
          onRowClicked(params)
        }
      },
      [onRowClicked, isCheckboxColumn]
    )

    // Expose clearFilters method through ref
    useImperativeHandle(
      forwardedRef,
      (): BCGridBaseHandle => ({
        ...ref.current,
        clearFilters
      })
    )

    const resolvedAutoSizeStrategy = useMemo(() => {
      if (autoSizeStrategy === null) {
        return undefined
      }

      return {
        type: 'fitGridWidth',
        defaultMinWidth: 50,
        ...autoSizeStrategy
      }
    }, [autoSizeStrategy])

    return (
      <AgGridReact
        ref={ref}
        domLayout={domLayout}
        containerStyle={{ height, ...containerStyle }}
        loadingOverlayComponent={loadingOverlayComponent}
        loadingOverlayComponentParams={{
          loadingMessage: 'One moment please...'
        }}
        animateRows
        autoSizeStrategy={resolvedAutoSizeStrategy}
        suppressDragLeaveHidesColumns
        suppressMovableColumns={suppressMovableColumns}
        suppressColumnMoveAnimation={false}
        suppressCsvExport={false}
        suppressColumnVirtualisation={true}
        enableBrowserTooltips={true}
        enableCellTextSelection={enableCellTextSelection}
        getRowId={getRowId}
        suppressPaginationPanel
        suppressScrollOnNewData
        onRowDataUpdated={determineHeight}
        overlayNoRowsTemplate={
          overlayNoRowsTemplate || defaultNoRowsOverlayTemplate
        }
        getRowStyle={(params) => {
          const defaultStyle =
            typeof getRowStyle === 'function' ? getRowStyle(params) : {}
          const gridOptionStyle =
            props.gridOptions &&
            typeof props.gridOptions.getRowStyle === 'function'
              ? props.gridOptions.getRowStyle(params)
              : {}
          return {
            ...defaultStyle,
            ...gridOptionStyle
          }
        }}
        rowHeight={ROW_HEIGHT}
        headerHeight={40}
        {...props}
        theme="legacy"
        onCellKeyDown={onCellKeyDown}
        onCellClicked={onCellClicked}
        onGridReady={onGridReady}
        onRowClicked={handleRowClicked}
      />
    )
  }
)

BCGridBase.displayName = 'BCGridBase'
