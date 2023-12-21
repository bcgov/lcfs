/* eslint-disable react-hooks/exhaustive-deps */
// ag-grid components
import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model'
import { ModuleRegistry } from '@ag-grid-community/core'
import { AgGridReact } from '@ag-grid-community/react'
import '@ag-grid-community/styles/ag-grid.css'
import '@ag-grid-community/styles/ag-theme-alpine.css'
// react components
import { PropTypes } from 'prop-types'
import { useState, useEffect, useCallback } from 'react'
// api service
import { useApiService } from '@/services/useApiService'
// Internal Components
import Loading from '@/components/Loading'
// @mui components
import { TablePagination } from '@mui/material'
import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
// Register the required feature modules with the Grid
ModuleRegistry.registerModules([ClientSideRowModelModule])

const BCGridServer = (props) => {
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)
  const [sortModel, setSortModel] = useState([
    {
      field: 'display_name',
      direction: 'asc'
    }
  ])
  const [filterModel, setFilterModel] = useState([])
  const [total, setTotal] = useState(0)
  const [rowData, setRowData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState('')

  const apiService = useApiService()
  const fetData = useCallback(
    () =>
      apiService({
        method: 'post',
        url: props.apiEndpoint,
        data: { page, size, sortOrders: sortModel }
      })
        .then((resp) => {
          setTotal(resp.data.total)
          setPage(resp.data.page)
          setRowData(resp.data.data)
          setIsLoading(false)
          setIsError(false)
        })
        .catch((err) => {
          setIsError(true)
          setError(err.message)
          setIsLoading(false)
        }),
    [apiService, props.apiEndpoint, page, size, sortModel]
  )

  const handleChangePage = useCallback((event, newPage) => {
    setPage(newPage + 1)
  })

  const handleChangeRowsPerPage = useCallback((event) => {
    setSize(parseInt(event.target.value, 10))
    setPage(1)
  })

  useEffect(() => {
    fetData()
  }, [page, size, sortModel, filterModel])

  const onGridReady = useCallback((params) => {
    params.api.sizeColumnsToFit()
    params.api.rowSelection = 'single'
    props.gridRef?.current?.api.applyColumnState({
      state: [{ colId: 'display_name', sort: 'asc' }],
      defaultState: { sort: null }
    })
  })
  const onSelectionChanged = useCallback(() => {
    const selectedRows = props.gridRef?.current?.api.getSelectedRows()
    document.querySelector('#selectedRows').innerHTML =
      selectedRows.length === 1 ? selectedRows[0].display_name : ''
  }, [])

  const onFilterChanged = useCallback(() => {
    const filterModel = props.gridRef?.current?.api.getFilterModel()
    setFilterModel([])
    console.log('Filter model', filterModel)
  }, [])

  const onSortChanged = useCallback(() => {
    const sortTemp = props.gridRef?.current?.api
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
        height: '50vh',
        width: '100%'
      }}
      className="bc-grid-container"
    >
      {isLoading ? (
        <Loading />
      ) : (
        <>
          <AgGridReact
            key={props.gridKey} // This will force the grid to re-render
            ref={props.gridRef} // Ref for accessing Grid's API
            className={props.className}
            columnDefs={props.columnDefs}
            defaultColDef={props.defaultColDef}
            rowData={rowData}
            onGridReady={onGridReady}
            gridOptions={props.gridOptions}
            onSelectionChanged={onSelectionChanged}
            onSortChanged={onSortChanged}
            onFilterChanged={onFilterChanged}
            getRowId={props.getRowId}
          />
          <TablePagination
            component="div"
            count={total}
            page={page - 1}
            onPageChange={handleChangePage}
            rowsPerPageOptions={[10, 20, 50, 100]}
            rowsPerPage={size}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </>
      )}
    </BCBox>
  )
}

BCGridServer.defaultProps = {
  gridRef: null,
  gridKey: `bcgrid-key-${Math.random()}`,
  gridOptions: {
    overlayNoRowsTemplate: 'No rows found',
    autoSizeStrategy: { type: 'fitCellContents' },
    suppressDragLeaveHidesColumns: true,
    suppressMovableColumns: false,
    suppressColumnMoveAnimation: false,
    rowSelection: 'multiple',
    animateRows: true,
    suppressPaginationPanel: true,
    suppressScrollOnNewData: true,
    rowHeight: 50
  },
  apiEndpoint: '/',
  className: 'ag-theme-alpine' // ag-theme-alpine ag-theme-material ag-theme-balham ag-theme-balham-dark ag-theme-balham-light ag-theme-balham-extended
}

BCGridServer.propTypes = {
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

export default BCGridServer
