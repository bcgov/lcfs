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
import GridLoading from '@/components/GridLoading'
// Register the required feature modules with the Grid
ModuleRegistry.registerModules([ClientSideRowModelModule])

const BCGridClient = ({
  gridOptions,
  gridKey,
  apiEndpoint,
  gridRef,
  className,
  columnDefs,
  defaultColDef,
  getRowId,
  ...others
}) => {
  const defaultGridOptions = useMemo(() => ({
    overlayNoRowsTemplate: 'No rows found',
    autoSizeStrategy: { type: 'fitCellContents' },
    suppressDragLeaveHidesColumns: true,
    suppressMovableColumns: false,
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

  const loadingOverlayComponent = useMemo(() => GridLoading)

  const onGridReady = useCallback((params) => {
    params.api.rowSelection = 'single'
    fetchData()
  })

  return isError ? (
    <div className="error-container">
      <div className="error-message">
        <BCAlert severity="error">
          {error}. Pleae contact your administrator.
        </BCAlert>
      </div>
    </div>
  ) : (
    <BCBox
      sx={{
        height: '60vh',
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
        loadingOverlayComponent={loadingOverlayComponent}
        {...others}
      />
    </BCBox>
  )
}

BCGridClient.defaultProps = {
  gridRef: null,
  gridKey: `bcgrid-key-${Math.random()}`,
  defaultSortModel: [],
  gridOptions: {},
  rowHeight: 40,
  headerHeight: 40,
  loadingOverlayComponentParams: { loadingMessage: 'One moment please...' },
  apiEndpoint: '/',
  className: 'ag-theme-alpine' // ag-theme-alpine ag-theme-material ag-theme-balham ag-theme-balham-dark ag-theme-balham-light ag-theme-balham-extended
}

BCGridClient.propTypes = {
  gridRef: PropTypes.oneOfType([
    PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    PropTypes.func
  ]).isRequired,
  columnDefs: PropTypes.array.isRequired,
  defaultColDef: PropTypes.object.isRequired,
  apiEndpoint: PropTypes.string.isRequired,
  gridKey: PropTypes.string,
  gridOptions: PropTypes.object,
  className: PropTypes.oneOf([
    'ag-theme-alpine',
    'ag-theme-material',
    'ag-theme-balham',
    'ag-theme-balham-dark',
    'ag-theme-balham-light',
    'ag-theme-balham-extended'
  ])
}

export default BCGridClient
