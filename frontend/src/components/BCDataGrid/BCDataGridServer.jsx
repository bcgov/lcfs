/* eslint-disable react-hooks/exhaustive-deps */
// ag-grid components
import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model'
import { CsvExportModule } from '@ag-grid-community/csv-export'
import { ModuleRegistry } from '@ag-grid-community/core'
import { AgGridReact } from '@ag-grid-community/react'
import '@ag-grid-community/styles/ag-grid.css'
import '@ag-grid-community/styles/ag-theme-alpine.css'
import '@ag-grid-community/styles/ag-theme-material.css'
// react components
import { PropTypes } from 'prop-types'
import { useState, useEffect, useCallback, useMemo } from 'react'
// api service
import { useApiService } from '@/services/useApiService'
// @mui components
import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import DataGridLoading from '@/components/DataGridLoading'
import { AccessibleHeader, BCPagination } from './components'
import { useTranslation } from 'react-i18next' // Import useTranslation
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
 * - enableExportButton: Flag to enable/disable a export button in the grid toolbar.
 * - exportName: The name to be used for the exported file and sheet.
 * - handleGridKey: Function to handle changes in the grid key.
 * - handleRowClicked: Function to handle row click events.
 * - suppressPagination: Flag to suppress pagination in the grid.
 * - others: Other props that can be spread into the AG Grid component.
 *
 * TODO:
 * - Ability to clear the custom filter input boxes
 * - Ability to populate the custom filter inputs from the stored values that are retrieved from sessionStorage.
 */
/**
 * @deprecated
 */
const BCDataGridServer = ({
  gridOptions,
  gridKey,
  defaultSortModel,
  defaultFilterModel,
  apiEndpoint,
  apiData,
  apiParams,
  gridRef,
  className,
  columnDefs,
  defaultColDef,
  getRowId,
  enableCopyButton,
  enableResetButton,
  enableExportButton,
  exportName,
  handleGridKey,
  handleRowClicked,
  paginationPageSize,
  paginationPageSizeSelector,
  highlightedRowId,
  suppressPagination,
  onSetResetGrid,
  ...others
}) => {
  const { t } = useTranslation(['report'])

  // State declarations
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(paginationPageSize)
  const [sortModel, setSortModel] = useState(defaultSortModel)
  const [filterModel, setFilterModel] = useState(defaultFilterModel)
  const [total, setTotal] = useState(0)
  const [rowData, setRowData] = useState()
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  // Fetch data from the API
  const apiService = useApiService()
  const fetchData = useCallback(
    () =>
      apiService({
        method: 'post',
        url: apiEndpoint,
        data: {
          page,
          size,
          sortOrders: sortModel,
          filters: filterModel,
          ...apiParams
        }
      })
        .then((resp) => {
          setTotal(resp.data.pagination.total)
          setPage(resp.data.pagination.page)
          setRowData(resp.data[apiData])
          setIsError(false)
          setLoading(false)
        })
        .catch((err) => {
          setRowData([])
          setIsError(true)
          setError(err.message)
          setLoading(false)
        }),
    [apiService, apiEndpoint, page, size, sortModel]
  )

  // Handle page change
  const handleChangePage = useCallback((event, newPage) => {
    setLoading(true)
    setPage(newPage + 1)
  })
  // Handle change in rows per page
  const handleChangeRowsPerPage = useCallback((event) => {
    setLoading(true)
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
  // if any filter or sort state is stored in browser local storage then apply them
  // if there are any default sort and filter model, apply them
  const onGridReady = useCallback((params) => {
    const filterState = JSON.parse(sessionStorage.getItem(`${gridKey}-filter`))
    const columnState = JSON.parse(sessionStorage.getItem(`${gridKey}-column`))
    if (filterState) {
      params.api.setFilterModel(filterState)
    }
    if (columnState) {
      params.api.applyColumnState({
        state: columnState,
        applyOrder: true
      })
    } else {
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
    }
  })

  // Callback for handling the first rendering of data
  const onFirstDataRendered = useCallback((params) => {
    setLoading(false)
    params.api.hideOverlay()
  })

  const resetGrid = useCallback(() => {
    // Clear sessionStorage
    sessionStorage.removeItem(`${gridKey}-filter`)
    sessionStorage.removeItem(`${gridKey}-column`)

    // Reset states
    setPage(1)
    setSize(paginationPageSize)
    setSortModel(defaultSortModel || [])
    setFilterModel([])

    // Clear UI filters
    if (gridRef.current?.api) {
      gridRef.current.api.setFilterModel(null)
      gridRef.current.api.applyColumnState({
        defaultState: { sort: null }
      })
    }
  }, [
    gridKey,
    paginationPageSize,
    defaultSortModel,
    defaultFilterModel,
    gridRef
  ])

  useEffect(() => {
    if (onSetResetGrid) {
      onSetResetGrid(resetGrid)
    }
  }, [onSetResetGrid, resetGrid])

  // Callback for grid filter changes.
  const onFilterChanged = useCallback(() => {
    setPage(1)
    setRowData([])
    setLoading(true)
    const filterModel = gridRef?.current?.api.getFilterModel()
    // Use the currently loaded data for local filtering
    let localFilteredData = [...rowData]

    // Handle the 'type' filter locally
    const typeFilter = filterModel.type

    if (typeFilter) {
      const filterText = typeFilter.filter?.toLowerCase() || ''
      localFilteredData = localFilteredData.filter((row) => {
        const typeLiteral = t('report:complianceReport').toLowerCase()
        return typeLiteral.includes(filterText)
      })

      // Remove 'type' from the filter model to prevent backend filtering
      delete filterModel.type
    }

    // Handle other filters (backend filters)
    const filterArr = [
      ...Object.entries(filterModel).map(([field, value]) => {
        // Check if the field is a date type and has an 'inRange' filter
        if (value.filterType === 'date' && value.type === 'inRange') {
          return {
            field,
            filterType: value.filterType,
            type: value.type,
            dateFrom: value.dateFrom,
            dateTo: value.dateTo
          }
        }
        return { field, ...value }
      }),
      ...defaultFilterModel
    ]
    setFilterModel(filterArr)

    // Update the row data with the locally filtered data
    setRowData(localFilteredData)

    // save the filter state in browser cache.
    sessionStorage.setItem(
      `${gridKey}-filter`,
      JSON.stringify(gridRef.current.api.getFilterModel())
    )
  }, [defaultFilterModel, gridRef, rowData, t])

  // Callback for grid sort changes.
  const onSortChanged = useCallback(() => {
    setPage(1)
    // setRowData([])
    setLoading(true)
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
    // save the sort state in browser cache.
    sessionStorage.setItem(
      `${gridKey}-column`,
      JSON.stringify(gridRef.current.api.getColumnState())
    )
  }, [])


  // Memorized default ag-grid options
  // For more details please refer https://ag-grid.com/javascript-data-grid/grid-options/
  const defaultGridOptions = useMemo(() => ({
    overlayNoRowsTemplate: 'No rows found',
    autoSizeStrategy: { type: 'fitGridWidth' },
    suppressDragLeaveHidesColumns: true,
    suppressMovableColumns: true,
    suppressColumnMoveAnimation: false,
    animateRows: true,
    suppressPaginationPanel: true,
    suppressScrollOnNewData: true,
    suppressColumnVirtualisation: true,
    enableBrowserTooltips: true,
    suppressCsvExport: false,
    // enableCellTextSelection: true, // enables text selection on the grid
    // ensureDomOrder: true,
    onRowClicked: handleRowClicked,
    getRowStyle: highlightedRowId
      ? (params) => {
          if (params.node.id === highlightedRowId) {
            return { backgroundColor: '#fade81' }
          }
        }
      : undefined
  }))

  // Memorized default column definition parameters
  const defaultColDefParams = useMemo(() => ({
    headerComponentParams: {
      innerHeaderComponent: AccessibleHeader
    },
    suppressHeaderFilterButton: true,
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
          {error}. Please contact your administrator.
        </BCAlert>
      </div>
    </div>
  ) : (
    <BCBox
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
      className={`bc-grid-container ${className}`}
    >
      <AgGridReact
        gridKey={gridKey} // This will force the grid to re-render
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
        domLayout="autoHeight"
        loading={loading}
        {...others}
      />
      {/* TablePagination components setup using Material UI,
       * so it looks similar to the one provided by ag-grid by default
       */}
      {!suppressPagination && (
        <BCBox
          className="ag-grid-pagination-container"
          display="flex"
          justifyContent="flex-start"
          variant="outlined"
          sx={{ maxHeight: '3.5rem', position: 'relative' }}
        >
          <BCPagination
            page={page}
            size={size}
            total={total}
            handleChangePage={handleChangePage}
            handleChangeRowsPerPage={handleChangeRowsPerPage}
            enableResetButton={enableResetButton}
            enableCopyButton={enableCopyButton}
            enableExportButton={enableExportButton}
            exportName={exportName}
            gridRef={gridRef}
            rowsPerPageOptions={paginationPageSizeSelector}
          />
        </BCBox>
      )}
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
  enableResetButton: false,
  enableCopyButton: true,
  enableExportButton: false,
  exportName: 'ExportData',
  className: 'ag-theme-material'
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
  enableExportButton: PropTypes.bool,
  exportName: PropTypes.string,
  gridOptions: PropTypes.object,
  suppressPagination: PropTypes.bool,
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
