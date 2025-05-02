import BCAlert, { FloatingAlert } from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import { BCGridBase } from '@/components/BCDataGrid/BCGridBase'
import {
  AccessibleHeader,
  BCPagination
} from '@/components/BCDataGrid/components'
import '@ag-grid-community/styles/ag-grid.css'
import '@ag-grid-community/styles/ag-theme-material.css'
import { forwardRef, useCallback, useMemo } from 'react'

export const BCGridViewer = forwardRef(
  ({
    gridRef,
    alertRef,
    loading,
    defaultColDef,
    columnDefs,
    gridOptions,
    suppressPagination,
    gridKey,
    getRowId,
    onRowClicked,
    autoSizeStrategy,

    paginationOptions = {
      page: 1,
      size: 10,
      sortOrders: [],
      filters: []
    },
    onPaginationChange,

    queryData,
    dataKey = 'items',

    enableExportButton = false,
    enableCopyButton = false,
    enableResetButton = false,
    paginationPageSizeSelector = [5, 10, 20, 25, 50, 100],
    exportName = 'ExportData',

    ...props
  }) => {
    const { data, error, isError, isLoading } = queryData

    const onGridReady = useCallback(
      (params) => {
        const filterState = JSON.parse(
          sessionStorage.getItem(`${gridKey}-filter`)
        )
        const columnState = JSON.parse(
          sessionStorage.getItem(`${gridKey}-column`)
        )
        if (filterState) {
          params.api.setFilterModel(filterState)
          const filterArr = [
            ...Object.entries(filterState).map(([field, value]) => {
              return { field, ...value }
            })
          ]
          onPaginationChange({ ...paginationOptions, filters: filterArr })
        }
        if (columnState) {
          params.api.applyColumnState({
            state: columnState,
            applyOrder: true
          })
        } else {
          params.api.applyColumnState(() => {
            let state = []
            if (
              paginationOptions.sortOrders &&
              paginationOptions.sortOrders.length > 0
            ) {
              state = paginationOptions.sortOrders.map((col) => ({
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
      [gridKey, paginationOptions.sortOrders]
    )

    const onFirstDataRendered = useCallback((params) => {
      params.api.hideOverlay()
    }, [])

    const handleChangePage = (_, newPage) => {
      onPaginationChange({ ...paginationOptions, page: newPage + 1 })
    }

    const handleChangeRowsPerPage = (event) => {
      onPaginationChange({
        ...paginationOptions,
        page: 1,
        size: parseInt(event.target.value, 10)
      })
    }

    const handleFilterChanged = useCallback(
      (grid) => {
        const gridFilters = grid.api.getFilterModel()
        const filterArr = [
          ...Object.entries(gridFilters).map(([field, value]) => {
            return { field, ...value }
          })
        ]

        onPaginationChange({
          ...paginationOptions,
          page: 1,
          filters: filterArr
        })
        sessionStorage.setItem(`${gridKey}-filter`, JSON.stringify(gridFilters))
      },
      [gridKey, onPaginationChange, paginationOptions.filters]
    )

    const handleSortChanged = useCallback(() => {
      const sortTemp = gridRef.current?.api
        .getColumnState()
        .filter((col) => col.sort)
        .sort((a, b) => a.sortIndex - b.sortIndex)
        .map((col) => {
          return {
            field: col.colId,
            direction: col.sort
          }
        })
      onPaginationChange({ ...paginationOptions, sortOrders: sortTemp })
      sessionStorage.setItem(
        `${gridKey}-column`,
        JSON.stringify(gridRef.current?.api.getColumnState())
      )
    }, [gridKey, onPaginationChange])

    const defaultColDefParams = useMemo(
      () => ({
        headerComponentParams: {
          innerHeaderComponent: AccessibleHeader
        },
        suppressHeaderFilterButton: true,
        resizable: true,
        sortable: true,
        filter: true,
        filterParams: {
          maxNumConditions: 1
        },
        floatingFilter: true,
        floatingFilterComponentParams: {
          browserAutoComplete: false
        }
      }),
      []
    )

    return isError && error?.response?.status !== 404 ? (
      <div className="error-container">
        <div className="error-message">
          <BCAlert severity="error">
            {error.message}. Please contact your administrator.
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
        data-test="bc-grid-container"
      >
        <FloatingAlert ref={alertRef} data-test="alert-box" delay={10000} />
        <BCGridBase
          ref={gridRef}
          className="ag-theme-material"
          loading={isLoading || loading}
          defaultColDef={{ ...defaultColDefParams, ...defaultColDef }}
          columnDefs={columnDefs}
          gridOptions={gridOptions}
          rowData={!isLoading && (data[dataKey] || [])}
          onGridReady={onGridReady}
          onSortChanged={handleSortChanged}
          onFilterChanged={handleFilterChanged}
          onFirstDataRendered={onFirstDataRendered}
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
              gridRef={gridRef}
              rowsPerPageOptions={paginationPageSizeSelector}
            />
          </BCBox>
        )}
      </BCBox>
    )
  }
)

BCGridViewer.displayName = 'BCGridViewer'
