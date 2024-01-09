/* eslint-disable react-hooks/exhaustive-deps */
// ag-grid components
import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model'
import { CsvExportModule } from '@ag-grid-community/csv-export'
import { ModuleRegistry } from '@ag-grid-community/core'
import { AgGridReact } from '@ag-grid-community/react'
import '@ag-grid-community/styles/ag-grid.css'
import '@ag-grid-community/styles/ag-theme-alpine.css'
// react components
import { PropTypes } from 'prop-types'
import { useState, useEffect, useCallback, useMemo } from 'react'
// api service
import { useApiService } from '@/services/useApiService'
// @mui components
import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import DataGridLoading from '@/components/DataGridLoading'
import BCPagination from './BCPagination'
// Register the required AG Grid modules for row model and CSV export functionality
ModuleRegistry.registerModules([ClientSideRowModelModule, CsvExportModule])

/**
 * BCDataGridServer is a server-side data grid component using AG Grid.
 * It supports features like pagination, sorting, filtering, and provides a seamless integration with an external API for data fetching.
 *
 * Props:
 * - gridOptions: Custom AG Grid options.
 * - gridKey: A unique key for the grid, used for re-rendering.
 * - defaultSortModel: Initial sorting state of the grid.
 * - defaultFilterModel: Initial filter state of the grid.
 * - apiEndpoint: The endpoint URL for fetching grid data.
 * - apiData: The key in the API response to access the actual data array.
 * - gridRef: A ref object for AG Grid to enable external control.
 * - className: Additional CSS classes for the grid.
 * - columnDefs: Column definitions for AG Grid.
 * - defaultColDef: Default column properties.
 * - getRowId: Function to uniquely identify each row.
 * - enableCopyButton: Flag to enable/disable a copy button in the grid toolbar.
 * - enableResetButton: Flag to enable/disable a reset button in the grid toolbar.
 * - handleGridKey: Function to handle changes in the grid key.
 * - handleRowClicked: Function to handle row click events.
 * - others: Other props that can be spread into the AG Grid component.
 */
const BCDataGridServer = ({
  gridOptions,
  gridKey,
  defaultSortModel,
  defaultFilterModel,
  apiEndpoint,
  apiData,
  gridRef,
  className,
  columnDefs,
  defaultColDef,
  getRowId,
  enableCopyButton,
  enableResetButton,
  handleGridKey,
  handleRowClicked,
  paginationPageSize,
  paginationPageSizeSelector,
  ...others
}) => {
  // State declarations
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(paginationPageSize)
  const [sortModel, setSortModel] = useState(defaultSortModel)
  const [filterModel, setFilterModel] = useState(defaultFilterModel)
  const [total, setTotal] = useState(0)
  const [rowData, setRowData] = useState()
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState('')

  // Fetch data from the API
  const apiService = useApiService()
  const fetchData = useCallback(
    () =>
      apiService({
        method: 'post',
        url: apiEndpoint,
        data: { page, size, sortOrders: sortModel, filters: filterModel }
      })
        .then((resp) => {
          setTotal(resp.data.pagination.total)
          setPage(resp.data.pagination.page)
          setRowData(resp.data[apiData])
          setIsError(false)
        })
        .catch((err) => {
          setRowData([])
          setIsError(true)
          setError(err.message)
        }),
    [apiService, apiEndpoint, page, size, sortModel]
  )

  // Hanlde page change
  const handleChangePage = useCallback((event, newPage) => {
    gridRef.current.api.showLoadingOverlay()
    setPage(newPage + 1)
  })
  // Handle change in rows per page
  const handleChangeRowsPerPage = useCallback((event) => {
    gridRef.current.api.showLoadingOverlay()
    setSize(parseInt(event.target.value, 10))
    setPage(1)
  })

  // Effect for fetching data based on dependency changes
  useEffect(() => {
    fetchData()
  }, [page, size, sortModel, filterModel])

  // Memorized custom loading overlay component
  const loadingOverlayComponent = useMemo(() => DataGridLoading)

  // Callback for ag-grid initialization
  // if there are any default sort and filter model, apply them
  const onGridReady = useCallback((params) => {
    params.api.applyColumnState(() => {
      let state = []
      if (defaultSortModel && defaultSortModel.length > 0) {
        state = defaultSortModel.map((col) => ({
          colId: col.field,
          sort: col.direction
        }))
        return {
          state,
          defaultState: { sort: null }
        }
      }
    })
  })

  // Callback for handling the first rendering of data
  const onFirstDataRendered = useCallback((params) => {
    params.api.hideOverlay()
  })

  // Callback for grid filter changes.
  const onFilterChanged = useCallback(() => {
    setPage(1)
    setRowData([])
    gridRef.current.api.showLoadingOverlay()
    const filterModel = gridRef?.current?.api.getFilterModel()
    const filterArr = Object.entries(filterModel).map(([field, value]) => {
      return { field, ...value }
    })
    setFilterModel(filterArr)
  }, [])

  // Callback for grid sort changes.
  const onSortChanged = useCallback(() => {
    setPage(1)
    setRowData([])
    gridRef.current.api.showLoadingOverlay()
    // forming the sortModel that fits with backend schema structure
    const sortTemp = gridRef?.current?.api
      .getColumnState()
      .filter((col) => col.sort)
      .sort((a, b) => a.sortIndex - b.sortIndex)
      .map((col) => {
        return {
          field: col.colId,
          direction: col.sort
        }
      })
    setSortModel(sortTemp)
  }, [])

  // Memorized default ag-grid options
  // For more details please refer https://ag-grid.com/javascript-data-grid/grid-options/
  const defaultGridOptions = useMemo(() => ({
    overlayNoRowsTemplate: 'No rows found',
    autoSizeStrategy: { type: 'fitGridWidth' },
    suppressDragLeaveHidesColumns: true,
    suppressMovableColumns: true,
    suppressColumnMoveAnimation: false,
    rowSelection: 'multiple',
    animateRows: true,
    suppressPaginationPanel: true,
    suppressScrollOnNewData: true,
    suppressCsvExport: false,
    // enableCellTextSelection: true, // enables text selection on the grid
    ensureDomOrder: true,
    onRowClicked: handleRowClicked
  }))

  // Memoized default column definition parameters
  const defaultColDefParams = useMemo(() => ({
    resizable: true,
    sortable: true,
    filter: true,
    filterParams: {
      maxNumConditions: 1 // maximum allowed conditions is 1, if more then one needs to be implemented, then backend should also be ready to cater
    },
    floatingFilter: true, // enables the filter boxes under the header label
    floatingFilterComponentParams: {
      browserAutoComplete: false
    }
  }))

  // Conditional rendering based on error state
  // If the error is not 404, then display the error message
  return isError && !error.includes('404') ? (
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
        defaultColDef={{ ...defaultColDefParams, ...defaultColDef }}
        rowData={rowData}
        onGridReady={onGridReady}
        gridOptions={{ ...defaultGridOptions, ...gridOptions }}
        onSortChanged={onSortChanged}
        onFilterChanged={onFilterChanged}
        onFirstDataRendered={onFirstDataRendered}
        getRowId={getRowId}
        loadingOverlayComponent={loadingOverlayComponent}
        {...others}
      />
      {/* TablePagination components setup using Material UI,
       * so it looks similar to the one provided by ag-grid by default
       */}
      <BCPagination
        page={page}
        size={size}
        total={total}
        handleChangePage={handleChangePage}
        handleChangeRowsPerPage={handleChangeRowsPerPage}
        enableResetButton={enableResetButton}
        enableCopyButton={enableCopyButton}
        gridRef={gridRef}
        rowsPerPageOptions={paginationPageSizeSelector}
      />
    </BCBox>
  )
}

/*
 * Default props and prop types.
 * But this component can be provided with other props
 * that can be served to ag-grid without having them to be declared here.
 * Please refer https://ag-grid.com/react-data-grid/reference/ for more details
 */
BCDataGridServer.defaultProps = {
  gridRef: null,
  gridKey: `bcgrid-key-<unique-id>`,
  paginationPageSize: 10,
  paginationPageSizeSelector: [5, 10, 20, 25, 50, 100],
  defaultSortModel: [],
  defaultFilterModel: [],
  gridOptions: {},
  rowHeight: 45,
  headerHeight: 40,
  loadingOverlayComponentParams: { loadingMessage: 'One moment please...' },
  apiEndpoint: '/',
  defaultColDef: {},
  enableResetButton: true,
  enableCopyButton: true,
  className: 'ag-theme-alpine'
}

BCDataGridServer.propTypes = {
  gridRef: PropTypes.oneOfType([
    PropTypes.shape({ current: PropTypes.instanceOf(AgGridReact) }),
    PropTypes.func
  ]).isRequired,
  columnDefs: PropTypes.array.isRequired,
  defaultColDef: PropTypes.object,
  defaultSortModel: PropTypes.array,
  defaultFilterModel: PropTypes.array,
  apiEndpoint: PropTypes.string.isRequired,
  apiData: PropTypes.string.isRequired,
  gridKey: PropTypes.string.isRequired,
  enableResetButton: PropTypes.bool,
  enableCopyButton: PropTypes.bool,
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

export default BCDataGridServer
