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
import { TablePagination } from '@mui/material'
import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import DataGridLoading from '@/components/DataGridLoading'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import { BCPaginationActions } from './BCPaginationActions'
// Register the required feature modules with the Grid
ModuleRegistry.registerModules([ClientSideRowModelModule, CsvExportModule])

const BCDataGridServer = ({
  gridOptions,
  gridKey,
  defaultSortModel,
  apiEndpoint,
  apiData,
  gridRef,
  className,
  columnDefs,
  defaultColDef,
  getRowId,
  handleGridKey,
  handleRowClicked,
  ...others
}) => {
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)
  const [sortModel, setSortModel] = useState(defaultSortModel)
  const [filterModel, setFilterModel] = useState([])
  const [total, setTotal] = useState(0)
  const [rowData, setRowData] = useState()
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState('')

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

  const handleChangePage = useCallback((event, newPage) => {
    gridRef.current.api.showLoadingOverlay()
    setPage(newPage + 1)
  })

  const handleChangeRowsPerPage = useCallback((event) => {
    gridRef.current.api.showLoadingOverlay()
    setSize(parseInt(event.target.value, 10))
    setPage(1)
  })

  const handleResetState = useCallback(() => {
    // Resets the column filter and sorts
    const filterInstance = gridRef.current.api.getFilterInstance('role')
    console.log(filterInstance)
    gridRef.current.api.resetColumnState()
    gridRef.current.api.setFilterModel(null)
  })

  useEffect(() => {
    fetchData()
  }, [page, size, sortModel, filterModel])

  const loadingOverlayComponent = useMemo(() => DataGridLoading)

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

  const onFirstDataRendered = useCallback((params) => {
    params.api.hideOverlay()
  })

  const onSelectionChanged = useCallback(() => {
    const selectedRows = gridRef?.current?.api.getSelectedRows()
    document.querySelector('#selectedRows').innerHTML =
      selectedRows.length === 1 ? selectedRows[0].display_name : ''
  }, [])

  const onFilterChanged = useCallback(() => {
    gridRef.current.api.showLoadingOverlay()
    const filterModel = gridRef?.current?.api.getFilterModel()
    const filterArr = Object.entries(filterModel).map(([field, value]) => {
      return { field, ...value }
    })
    setFilterModel(filterArr)
  }, [])

  const onSortChanged = useCallback(() => {
    gridRef.current.api.showLoadingOverlay()
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

  const defaultColDefParams = useMemo(() => ({
    resizable: true,
    sortable: true,
    filter: true,
    filterParams: {
      maxNumConditions: 1 // maximum allowed conditions is 1, if more then one needs to be implemented, then backenc should also be ready to cater
    },
    floatingFilter: true, // enables the filter boxes under the header label
    floatingFilterComponentParams: {
      browserAutoComplete: false
    }
  }))

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
        onSelectionChanged={onSelectionChanged}
        onSortChanged={onSortChanged}
        onFilterChanged={onFilterChanged}
        onFirstDataRendered={onFirstDataRendered}
        getRowId={getRowId}
        loadingOverlayComponent={loadingOverlayComponent}
        {...others}
      />
      <TablePagination
        aria-label="pagination BC DataGrid"
        component="div"
        count={total}
        page={page - 1}
        onPageChange={handleChangePage}
        rowsPerPageOptions={[5, 10, 20, 25, 50, 100]}
        rowsPerPage={size}
        onRowsPerPageChange={handleChangeRowsPerPage}
        labelRowsPerPage={'Page Size:'}
        labelDisplayedRows={({ from, to, count }) => (
          <>
            <b>{from}</b>&nbsp;to&nbsp;<b>{to}</b>&nbsp;of&nbsp;
            <b>{count}</b>
          </>
        )}
        showFirstButton
        showLastButton
        ActionsComponent={(subProps) => (
          <BCPaginationActions
            {...subProps}
            handleResetState={handleResetState}
            gridRef={gridRef}
          />
        )}
        slots={{
          root: 'div',
          toolbar: 'nav'
        }}
        slotProps={{
          select: {
            IconComponent: (props) => (
              <ArrowDropDownIcon
                fontSize="medium"
                sx={{ marginRight: '-8px' }}
                {...props}
              />
            )
          }
        }}
      />
    </BCBox>
  )
}

BCDataGridServer.defaultProps = {
  gridRef: null,
  gridKey: `bcgrid-key-${Math.random()}`,
  defaultSortModel: [],
  gridOptions: {},
  rowHeight: 45,
  headerHeight: 40,
  loadingOverlayComponentParams: { loadingMessage: 'One moment please...' },
  apiEndpoint: '/',
  defaultColDef: {},
  className: 'ag-theme-alpine'
}

BCDataGridServer.propTypes = {
  gridRef: PropTypes.oneOfType([
    PropTypes.shape({ current: PropTypes.instanceOf(AgGridReact) }),
    PropTypes.func
  ]),
  columnDefs: PropTypes.array.isRequired,
  defaultColDef: PropTypes.object,
  defaultSortModel: PropTypes.array,
  apiEndpoint: PropTypes.string.isRequired,
  apiData: PropTypes.string.isRequired,
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

export default BCDataGridServer
