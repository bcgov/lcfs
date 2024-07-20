import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import { BCGridBase } from '@/components/BCDataGrid/BCGridBase'
import { BCPagination } from '@/components/BCDataGrid/components'
import '@ag-grid-community/styles/ag-grid.css'
import '@ag-grid-community/styles/ag-theme-material.css'
import { useCallback, useMemo, useRef, useState } from 'react'

export const BCGridViewer = ({
  suppressPagination,
  paginationPageSize = 10,
  defaultSortModel = [],
  defaultFilterModel = [],
  paginationPageSizeSelector = [5, 10, 20, 25, 50, 100],
  exportName = 'ExportData',
  enableExportButton = false,
  enableCopyButton = true,
  enableResetButton = false,
  query,
  queryParams = {},
  dataKey,
  defaultColDef,
  gridKey,
  gridOptions,
  columnDefs,
  getRowId,
  onRowClicked,
  autoSizeStrategy,
  gridRef,
  ...props
}) => {
  const localRef = useRef(null)
  const ref = gridRef || localRef

  const [page, setPage] = useState(1)
  const [size, setSize] = useState(paginationPageSize)
  const [sortModel, setSortModel] = useState(defaultSortModel)
  const [filterModel, setFilterModel] = useState(defaultFilterModel)

  const { data, error, isError, isLoading } = query(
    {
      page,
      size,
      sortOrders: sortModel,
      filters: filterModel,
      ...queryParams
    },
    { retry: false }
  )

  const onGridReady = useCallback(
    (params) => {
      const filterState = JSON.parse(localStorage.getItem(`${gridKey}-filter`))
      const columnState = JSON.parse(localStorage.getItem(`${gridKey}-column`))
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
    },
    [defaultSortModel, gridKey]
  )

  const onFirstDataRendered = useCallback((params) => {
    params.api.hideOverlay()
  }, [])

  const handleChangePage = useCallback((event, newPage) => {
    setPage(newPage + 1)
  }, [])

  const handleChangeRowsPerPage = useCallback((event) => {
    setSize(parseInt(event.target.value, 10))
    setPage(1)
  }, [])

  const onFilterChanged = useCallback(() => {
    setPage(1)
    const filterModel = ref.current?.api.getFilterModel()
    const filterArr = [
      ...Object.entries(filterModel).map(([field, value]) => {
        return { field, ...value }
      }),
      ...defaultFilterModel
    ]
    setFilterModel(filterArr)
    // save the filter state in browser cache.
    localStorage.setItem(
      `${gridKey}-filter`,
      JSON.stringify(ref.current?.api.getFilterModel())
    )
  }, [defaultFilterModel, gridKey, ref])

  const onSortChanged = useCallback(() => {
    setPage(1)

    // forming the sortModel that fits with backend schema structure
    const sortTemp = ref.current?.api
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
    localStorage.setItem(
      `${gridKey}-column`,
      JSON.stringify(ref.current?.api.getColumnState())
    )
  }, [gridKey, ref])

  const defaultColDefParams = useMemo(
    () => ({
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
    }),
    []
  )

  return isError && error.response.status !== 404 ? (
    <div className="error-container">
      <div className="error-message">
        <BCAlert severity="error">
          {error.message}. Pleae contact your administrator.
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
      className="bc-grid-container"
    >
      <BCGridBase
        ref={ref}
        className={'ag-theme-material'}
        loading={isLoading}
        defaultColDef={{ ...defaultColDefParams, ...defaultColDef }}
        gridOptions={gridOptions}
        rowData={!isLoading && data[dataKey]}
        onGridReady={onGridReady}
        onSortChanged={onSortChanged}
        onFilterChanged={onFilterChanged}
        onFirstDataRendered={onFirstDataRendered}
        columnDefs={columnDefs}
        onRowClicked={onRowClicked}
        getRowId={getRowId}
        autoSizeStrategy={autoSizeStrategy}
        {...props}
      />
      {!suppressPagination && (
        <BCBox
          className="ag-grid-pagination-container"
          display="flex"
          justifyContent="flex-start"
          variant="outlined"
          sx={{ maxHeight: '3.5rem', position: 'relative' }}
        >
          <BCPagination
            page={data?.pagination.page || 1}
            size={data?.pagination.size || 10}
            total={data?.pagination.total || 0}
            handleChangePage={handleChangePage}
            handleChangeRowsPerPage={handleChangeRowsPerPage}
            enableResetButton={enableResetButton}
            enableCopyButton={enableCopyButton}
            enableExportButton={enableExportButton}
            exportName={exportName}
            gridRef={ref}
            rowsPerPageOptions={paginationPageSizeSelector}
          />
        </BCBox>
      )}
    </BCBox>
  )
}
