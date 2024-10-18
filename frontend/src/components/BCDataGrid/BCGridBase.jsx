/* eslint-disable react-hooks/exhaustive-deps */
import DataGridLoading from '@/components/DataGridLoading'
import { AgGridReact } from '@ag-grid-community/react'
import '@ag-grid-community/styles/ag-grid.css'
import '@ag-grid-community/styles/ag-theme-material.css'
import { forwardRef, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

export const BCGridBase = forwardRef(({ autoSizeStrategy, ...props }, ref) => {
  const [searchParams] = useSearchParams()
  const highlightedId = searchParams.get('hid')

  const loadingOverlayComponent = useMemo(() => DataGridLoading, [])

  const getRowStyle = useCallback((params) => {
    if (params.node.id === highlightedId) {
      return { backgroundColor: '#fade81' }
    }
  }, [])

  return (
    <>
      <AgGridReact
        ref={ref}
        loadingOverlayComponent={loadingOverlayComponent}
        domLayout="autoHeight"
        loadingOverlayComponentParams={{
          loadingMessage: 'One moment please...'
        }}
        animateRows
        overlayNoRowsTemplate="No rows found"
        autoSizeStrategy={{ type: 'fitCellContents', ...autoSizeStrategy }}
        suppressDragLeaveHidesColumns
        suppressMovableColumns
        suppressColumnMoveAnimation={false}
        reactiveCustomComponents
        rowSelection="multiple"
        suppressCsvExport={false}
        suppressPaginationPanel
        suppressScrollOnNewData
        getRowStyle={getRowStyle}
        rowHeight={45}
        headerHeight={45}
        {...props}
      />
    </>
  )
})

BCGridBase.displayName = 'BCGridBase'
