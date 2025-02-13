/* eslint-disable react-hooks/exhaustive-deps */
import DataGridLoading from '@/components/DataGridLoading'
import { AgGridReact } from '@ag-grid-community/react'
import '@ag-grid-community/styles/ag-grid.css'
import '@ag-grid-community/styles/ag-theme-material.css'
import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useImperativeHandle
} from 'react'
import { useSearchParams } from 'react-router-dom'

const ROW_HEIGHT = 45

export const BCGridBase = forwardRef(
  ({ autoSizeStrategy, autoHeight, ...props }, ref) => {
    const [searchParams] = useSearchParams()
    const highlightedId = searchParams.get('hid')
    const gridRef = useRef(null)

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
        props.onGridReady(params)
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
      const api = gridRef.current?.api
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

    // Expose clearFilters method through ref
    useImperativeHandle(ref, () => ({
      ...gridRef.current,
      clearFilters
    }))

    const closeSelectsOnScroll = (e) => {
      const cell = e.api.getFocusedCell()

      if (cell) {
        e.api.clearFocusedCell()
      }
    }
    return (
      <AgGridReact
        ref={gridRef}
        domLayout={domLayout}
        containerStyle={{ height }}
        loadingOverlayComponent={loadingOverlayComponent}
        loadingOverlayComponentParams={{
          loadingMessage: 'One moment please...'
        }}
        animateRows
        overlayNoRowsTemplate="No rows found"
        autoSizeStrategy={{ type: 'fitCellContents', ...autoSizeStrategy }}
        suppressDragLeaveHidesColumns
        suppressMovableColumns
        suppressColumnMoveAnimation={false}
        suppressCsvExport={false}
        suppressColumnVirtualisation={true}
        enableBrowserTooltips={true}
        suppressPaginationPanel
        suppressScrollOnNewData
        onBodyScroll={closeSelectsOnScroll}
        onRowDataUpdated={determineHeight}
        getRowStyle={(params) => ({
          ...getRowStyle(params),
          ...props.gridOptions.getRowStyle(params)
        })}
        rowHeight={ROW_HEIGHT}
        headerHeight={40}
        {...props}
        onGridReady={onGridReady}
      />
    )
  }
)

BCGridBase.displayName = 'BCGridBase'
