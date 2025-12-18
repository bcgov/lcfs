/* eslint-disable react-hooks/exhaustive-deps */
import DataGridLoading from '@/components/DataGridLoading'
import { AgGridReact } from '@ag-grid-community/react'
import '@ag-grid-community/styles/ag-grid.css'
import '@ag-grid-community/styles/ag-theme-material.css'
import { ModuleRegistry } from '@ag-grid-community/core'
import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model'
import { CsvExportModule } from '@ag-grid-community/csv-export'
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

const ROW_HEIGHT = 45

export const BCGridBase = forwardRef(
  (
    {
      autoSizeStrategy,
      autoHeight,
      enableCellTextSelection,
      getRowId,
      overlayNoRowsTemplate,
      queryData,
      dataKey,
      paginationOptions,
      onPaginationChange,
      onRowClicked,
      ...props
    },
    forwardedRef
  ) => {
    ModuleRegistry.registerModules([ClientSideRowModelModule, CsvExportModule])
    const [searchParams] = useSearchParams()
    const highlightedId = searchParams.get('hid')
    const ref = useRef(null)

    const loadingOverlayComponent = useMemo(() => DataGridLoading, [])

    const getRowStyle = useCallback((params) => {
      if (params.node.id === highlightedId) {
        return { backgroundColor: '#fade81' }
      }
    }, [])

    const gridApiRef = useRef(null)
    const [domLayout, setDomLayout] = useState('autoHeight')
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
      (params) => {
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
        const columns = api.getColumnDefs()
        columns.forEach((column) => {
          api.destroyFilter(column.field)
        })
      }
    }, [])

    // Handle keyboard events for row navigation
    const onCellKeyDown = useCallback(
      (params) => {
        const e = params.event

        if (e.code === 'Enter' && params.node) {
          const cellEl = e.target.closest('.ag-cell')
          if (!cellEl) return

          const link = cellEl.querySelector('a[href]')
          if (link) {
            e.preventDefault()
            e.stopPropagation()
            link.click()
            return
          }

          const focusables = cellEl.querySelectorAll(
            'button, [href], :not(.ag-hidden) > input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
          if (focusables.length === 0 && onRowClicked) {
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

    // Expose clearFilters method through ref
    useImperativeHandle(forwardedRef, () => ({
      ...ref.current,
      clearFilters
    }))

    return (
      <AgGridReact
        ref={ref}
        domLayout={domLayout}
        containerStyle={{ height }}
        loadingOverlayComponent={loadingOverlayComponent}
        loadingOverlayComponentParams={{
          loadingMessage: 'One moment please...'
        }}
        animateRows
        autoSizeStrategy={{ type: 'fitCellContents', ...autoSizeStrategy }}
        suppressDragLeaveHidesColumns
        suppressMovableColumns
        suppressColumnMoveAnimation={false}
        suppressCsvExport={false}
        suppressColumnVirtualisation={true}
        enableBrowserTooltips={true}
        enableCellTextSelection={enableCellTextSelection}
        getRowId={getRowId}
        suppressPaginationPanel
        suppressScrollOnNewData
        onRowDataUpdated={determineHeight}
        overlayNoRowsTemplate={overlayNoRowsTemplate || "No rows found"}
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
        onCellKeyDown={onCellKeyDown}
        onGridReady={onGridReady}
        onRowClicked={onRowClicked}
      />
    )
  }
)

BCGridBase.displayName = 'BCGridBase'
