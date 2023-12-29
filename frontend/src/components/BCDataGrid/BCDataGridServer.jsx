/* eslint-disable react-hooks/exhaustive-deps */
// ag-grid components
import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model'
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
ModuleRegistry.registerModules([ClientSideRowModelModule])

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
    suppressPaginationPanel: true,
    suppressScrollOnNewData: true,
    // enableCellTextSelection: true, // enables the ability to copy the text from cell
    ensureDomOrder: true
  }))

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
          setIsError(true)
          setError(err.message)
        }),
    [apiService, apiEndpoint, page, size, sortModel]
  )

  const handleChangePage = useCallback((event, newPage) => {
    setPage(newPage + 1)
  })

  const handleChangeRowsPerPage = useCallback((event) => {
    setSize(parseInt(event.target.value, 10))
    setPage(1)
  })

  const handleResetState = useCallback(() => {
    gridRef.current.api.resetColumnState()
  })
  useEffect(() => {
    fetchData()
  }, [page, size, sortModel, filterModel])

  const loadingOverlayComponent = useMemo(() => DataGridLoading)

  const onGridReady = useCallback((params) => {
    params.api.sizeColumnsToFit()
    params.api.rowSelection = 'single'
    gridRef?.current?.api.applyColumnState(() => {
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
  const onSelectionChanged = useCallback(() => {
    const selectedRows = gridRef?.current?.api.getSelectedRows()
    document.querySelector('#selectedRows').innerHTML =
      selectedRows.length === 1 ? selectedRows[0].display_name : ''
  }, [])

  const onFilterChanged = useCallback(() => {
    const filterModel = gridRef?.current?.api.getFilterModel()
    setFilterModel([])
    console.log('Filter model', filterModel)
  }, [])

  const onSortChanged = useCallback(() => {
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
        onSelectionChanged={onSelectionChanged}
        onSortChanged={onSortChanged}
        onFilterChanged={onFilterChanged}
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
  className: 'ag-theme-alpine' // ag-theme-alpine ag-theme-material ag-theme-balham ag-theme-balham-dark ag-theme-balham-light ag-theme-balham-extended
}

BCDataGridServer.propTypes = {
  gridRef: PropTypes.oneOfType([
    PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    PropTypes.func
  ]).isRequired,
  columnDefs: PropTypes.array.isRequired,
  defaultColDef: PropTypes.object.isRequired,
  defaultSortModel: PropTypes.array.isRequired,
  apiEndpoint: PropTypes.string.isRequired,
  apiData: PropTypes.string.isRequired,
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

export default BCDataGridServer
