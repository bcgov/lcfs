/* eslint-disable react-hooks/exhaustive-deps */
// ag-grid components
import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model'
import { ModuleRegistry } from '@ag-grid-community/core'
import { AgGridReact } from '@ag-grid-community/react'
import '@ag-grid-community/styles/ag-grid.css'
import '@ag-grid-community/styles/ag-theme-alpine.css'
// react components
import { PropTypes } from 'prop-types'
import { useState, useCallback, useMemo } from 'react'
// api service
import { useApiService } from '@/services/useApiService'
// @mui components
import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import DataGridLoading from '@/components/DataGridLoading'
// Register the required feature modules with the Grid
ModuleRegistry.registerModules([ClientSideRowModelModule])

const BCDataGridClient = ({
  gridOptions,
  gridKey,
  apiEndpoint,
  gridRef,
  className,
  columnDefs,
  defaultColDef,
  getRowId,
  inputData,
  ...others
}) => {
  const defaultGridOptions = useMemo(() => ({
    overlayNoRowsTemplate: 'No rows found',
    autoSizeStrategy: { type: 'fitCellContents' },
    suppressDragLeaveHidesColumns: true,
    suppressMovableColumns: true,
    suppressColumnMoveAnimation: false,
    rowSelection: 'multiple',
    animateRows: true,
    pagination: true,
    paginationPageSize: 10,
    paginationPageSizeSelector: [5, 10, 20, 25, 50, 100]
  }))

  const [rowData, setRowData] = useState()
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState('')

  const apiService = useApiService()
  const fetchData = useCallback(
    () =>
      apiService({
        method: 'get',
        url: apiEndpoint
      })
        .then((resp) => {
          setRowData(resp.data)
          setIsError(false)
        })
        .catch((err) => {
          setIsError(true)
          setError(err.message)
        }),
    [apiService, apiEndpoint]
  )

  const loadingOverlayComponent = useMemo(() => DataGridLoading)

  const onGridReady = useCallback((params) => {
    params.api.rowSelection = 'single'
    if (inputData) {
      setRowData(inputData)
    } else {
      fetchData()
    }
  })

  return isError && !error.includes('404') ? (
    <div className="error-container">
      <div className="error-message">
        <BCAlert severity="error">
          {error}. Please contact your administrator.
        </BCAlert>
      </div>
    </div>
  ) : (
    <BCBox
      sx={{
        height: '54vh',
        width: '100%'
      }}
      className="bc-grid-container"
    >
      <AgGridReact
        key={gridKey} // This will force the grid to re-render
        ref={gridRef} // Ref for accessing Grid's API
        className={className}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        rowData={rowData}
        onGridReady={onGridReady}
        gridOptions={{ ...defaultGridOptions, ...gridOptions }}
        getRowId={getRowId}
        domLayout="autoHeight"
        loadingOverlayComponent={loadingOverlayComponent}
        {...others}
      />
    </BCBox>
  )
}

BCDataGridClient.defaultProps = {
  gridRef: null,
  gridKey: `bcgrid-key-${Math.random()}`,
  defaultSortModel: [],
  defaultColDef: {},
  gridOptions: {},
  rowHeight: 40,
  headerHeight: 40,
  loadingOverlayComponentParams: { loadingMessage: 'One moment please...' },
  apiEndpoint: '/',
  className: 'ag-theme-alpine'
}

BCDataGridClient.propTypes = {
  gridRef: PropTypes.oneOfType([
    PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    PropTypes.func
  ]).isRequired,
  columnDefs: PropTypes.array.isRequired,
  defaultColDef: PropTypes.object,
  apiEndpoint: PropTypes.string.isRequired,
  gridKey: PropTypes.string,
  gridOptions: PropTypes.object,
  className: PropTypes.oneOf([
    'ag-theme-alpine',
    'ag-theme-alpine-dark',
    'ag-theme-alpine-auto-dark',
    'ag-theme-material',
    'ag-theme-quartz',
    'ag-theme-quartz-dark',
    'ag-theme-quartz-auto-dark',
    'ag-theme-balham',
    'ag-theme-balham-dark',
    'ag-theme-balham-auto-dark'
  ])
}

export default BCDataGridClient
