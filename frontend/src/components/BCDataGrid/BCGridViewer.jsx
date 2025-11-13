import BCAlert, { FloatingAlert } from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import { BCGridBase } from '@/components/BCDataGrid/BCGridBase'
import {
  AccessibleHeader,
  BCPagination
} from '@/components/BCDataGrid/components'
import '@ag-grid-community/styles/ag-grid.css'
import '@ag-grid-community/styles/ag-theme-material.css'
import {
  forwardRef,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  useState
} from 'react'

// Styles for floating pagination
const floatingPaginationStyles = {
  position: 'fixed',
  bottom: '1rem',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 1000,
  backgroundColor: 'white',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  borderRadius: '8px',
  border: '1px solid #e0e0e0',
  minWidth: '400px',
  maxWidth: '90vw'
}

const normalPaginationStyles = {
  maxHeight: '3.5rem',
  position: 'relative'
}
const floatingScrollStyles = {
  position: 'fixed',
  bottom: '0.25rem',
  left: 0,
  right: 0,
  top: 55,
  overflowX: 'auto',
  height: '16px',
  zIndex: 999,
  background: '#fafafa'
}

const isIntersectionObserverSupported = () => {
  return typeof window !== 'undefined' && 'IntersectionObserver' in window
}

export const BCGridViewer = forwardRef(
  (
    {
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
      autoSizeStrategy = {},

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
      enablePageCaching = true,
      paginationPageSizeSelector = [5, 10, 20, 25, 50, 100],
      exportName = 'ExportData',
      enableFloatingPagination = true,
      ...props
    },
    ref
  ) => {
    const { data, error, isError, isLoading } = queryData || {}
    const hasInitializedFromCache = useRef(false)
    const previousGridKey = useRef(gridKey)
    const isRestoringFromCache = useRef(false)

    // Refs and state for floating pagination
    const paginationRef = useRef(null)
    const gridContainerRef = useRef(null)
    const [isPaginationVisible, setIsPaginationVisible] = useState(true)
    const [isGridVisible, setIsGridVisible] = useState(true)
    const [showScrollbar, setShowScrollbar] = useState(false)

    const isPaginationFloating = !isPaginationVisible && isGridVisible

    // Cache pagination options to sessionStorage
    const cachePaginationOptions = useCallback(
      (options) => {
        if (enablePageCaching && gridKey) {
          const cacheData = {
            page: options.page,
            size: options.size,
            sortOrders: options.sortOrders || [],
            filters: options.filters || []
          }
          sessionStorage.setItem(
            `${gridKey}-pagination`,
            JSON.stringify(cacheData)
          )
        }
      },
      [gridKey, enablePageCaching]
    )

    // Restore pagination options from sessionStorage
    const getCachedPaginationOptions = useCallback(() => {
      if (!enablePageCaching || !gridKey) return paginationOptions

      const cachedPagination = sessionStorage.getItem(`${gridKey}-pagination`)
      if (cachedPagination) {
        try {
          const parsed = JSON.parse(cachedPagination)
          const result = {
            ...paginationOptions,
            ...parsed
          }
          return result
        } catch (error) {
          console.warn('Failed to parse cached pagination options:', error)
        }
      }
      return paginationOptions
    }, [gridKey, paginationOptions, enablePageCaching])

    // Decicision maker to determine if the scrollbar to be shown or not.
    useEffect(() => {
      const container = gridContainerRef?.current?.querySelector(
        '.ag-center-cols-viewport'
      )
      const content = gridContainerRef?.current?.querySelector(
        '.ag-center-cols-container'
      )

      if (container && content) {
        setShowScrollbar(content.scrollWidth > container.clientWidth)
      }
    }, [data])

    // Initialize with cached pagination options if available
    useEffect(() => {
      if (enablePageCaching && gridKey && !hasInitializedFromCache.current) {
        const cachedPagination = sessionStorage.getItem(`${gridKey}-pagination`)
        if (cachedPagination) {
          try {
            const cachedOptions = JSON.parse(cachedPagination)
            const restoredOptions = {
              ...paginationOptions,
              ...cachedOptions
            }
            hasInitializedFromCache.current = true
            onPaginationChange(restoredOptions)
          } catch (error) {
            console.warn('Failed to parse cached pagination options:', error)
          }
        }
      }
    }, [enablePageCaching, gridKey])

    // Reset initialization flag when gridKey changes
    useEffect(() => {
      if (previousGridKey.current !== gridKey) {
        hasInitializedFromCache.current = false
        isRestoringFromCache.current = false
        previousGridKey.current = gridKey
      }
    }, [gridKey])

    // Intersection Observer for pagination and grid visibility
    useEffect(() => {
      if (
        !enableFloatingPagination ||
        suppressPagination ||
        !paginationRef.current ||
        !gridContainerRef.current ||
        !isIntersectionObserverSupported()
      ) {
        return
      }

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.target === paginationRef.current) {
              setIsPaginationVisible(entry.isIntersecting)
            } else if (entry.target === gridContainerRef.current) {
              setIsGridVisible(entry.isIntersecting)
            }
          })
        },
        {
          root: null,
          rootMargin: '0px',
          threshold: 0.1
        }
      )

      observer.observe(paginationRef.current)
      observer.observe(gridContainerRef.current)

      return () => {
        observer.disconnect()
      }
    }, [enableFloatingPagination, suppressPagination, data])

    const onGridReady = useCallback(
      (params) => {
        const filterState = JSON.parse(
          sessionStorage.getItem(`${gridKey}-filter`)
        )
        const columnState = JSON.parse(
          sessionStorage.getItem(`${gridKey}-column`)
        )

        // Apply filters if they exist
        if (filterState) {
          // Set restoration flag to prevent filter change handler from interfering
          isRestoringFromCache.current = true
          params.api.setFilterModel(filterState)

          // Only update pagination if we haven't initialized from cache
          // or if cache is disabled
          if (!enablePageCaching || !hasInitializedFromCache.current) {
            const filterArr = [
              ...Object.entries(filterState).map(([field, value]) => {
                return { field, ...value }
              })
            ]
            const updatedOptions = {
              ...paginationOptions,
              page: 1, // Reset to page 1 for new filters
              filters: filterArr
            }
            onPaginationChange(updatedOptions)
            if (enablePageCaching) {
              cachePaginationOptions(updatedOptions)
            }
          }

          // Reset restoration flag after a brief delay to allow filter events to complete
          setTimeout(() => {
            isRestoringFromCache.current = false
          }, 100)
        }

        // Apply column state
        if (columnState) {
          params.api.applyColumnState({
            state: columnState,
            applyOrder: true
          })
        } else {
          // Apply sort orders from current pagination options
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
      [
        gridKey,
        enablePageCaching,
        paginationOptions,
        onPaginationChange,
        cachePaginationOptions
      ]
    )

    const onFirstDataRendered = useCallback((params) => {
      params.api.hideOverlay()
    }, [])

    const handleChangePage = (_, newPage) => {
      const updatedOptions = { ...paginationOptions, page: newPage + 1 }
      onPaginationChange(updatedOptions)
      if (enablePageCaching) {
        cachePaginationOptions(updatedOptions)
      }
    }

    const handleChangeRowsPerPage = (event) => {
      const updatedOptions = {
        ...paginationOptions,
        page: 1,
        size: parseInt(event.target.value, 10)
      }
      onPaginationChange(updatedOptions)
      if (enablePageCaching) {
        cachePaginationOptions(updatedOptions)
      }
    }

    const handleFilterChanged = useCallback(
      (grid) => {
        // Skip filter change handling if we're currently restoring from cache
        if (isRestoringFromCache.current) {
          return
        }

        const gridFilters = grid.api.getFilterModel()
        const filterArr = [
          ...Object.entries(gridFilters).map(([field, value]) => {
            return { field, ...value }
          })
        ]

        const updatedOptions = {
          ...paginationOptions,
          page: 1, // Always reset to page 1 when filters change
          filters: filterArr
        }
        onPaginationChange(updatedOptions)
        if (enablePageCaching) {
          cachePaginationOptions(updatedOptions)
        }
        sessionStorage.setItem(`${gridKey}-filter`, JSON.stringify(gridFilters))
      },
      [
        gridKey,
        onPaginationChange,
        paginationOptions,
        enablePageCaching,
        cachePaginationOptions
      ]
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

      const updatedOptions = { ...paginationOptions, sortOrders: sortTemp }
      onPaginationChange(updatedOptions)
      if (enablePageCaching) {
        cachePaginationOptions(updatedOptions)
      }
      sessionStorage.setItem(
        `${gridKey}-column`,
        JSON.stringify(gridRef.current?.api.getColumnState())
      )
    }, [
      gridKey,
      onPaginationChange,
      paginationOptions,
      enablePageCaching,
      cachePaginationOptions
    ])

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
        ref={gridContainerRef}
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
          defaultColDef={{
            tooltipValueGetter: (params) => {
              // Show the cell value on hover
              return params.value !== null && params.value !== undefined
                ? String(params.value)
                : 'No data'
            },
            ...defaultColDefParams,
            ...defaultColDef
          }}
          columnDefs={columnDefs}
          gridOptions={gridOptions}
          rowData={!isLoading && ((data && data[dataKey]) || [])}
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
          <>
            {/* Original pagination container for intersection observation */}
            <BCBox
              ref={paginationRef}
              className="ag-grid-pagination-container"
              display="flex"
              justifyContent="flex-start"
              variant="outlined"
              sx={{
                ...normalPaginationStyles,
                visibility:
                  isPaginationFloating && enableFloatingPagination
                    ? 'hidden'
                    : 'visible'
              }}
            >
              <BCPagination
                page={data?.pagination?.page || paginationOptions.page || 1}
                size={data?.pagination?.size || paginationOptions.size || 10}
                total={data?.pagination?.total ?? data?.total_count ?? 0}
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

            {/* Floating pagination container */}
            {isPaginationFloating &&
              enableFloatingPagination &&
              (data?.pagination?.size || paginationOptions.size || 10) > 10 &&
              (data?.pagination?.total ||
                data?.total_count ||
                paginationOptions.total ||
                10) > 10 && (
                <BCBox
                  className="ag-grid-pagination-container-floating"
                  display="flex"
                  justifyContent="center"
                  variant="outlined"
                  sx={{
                    ...floatingPaginationStyles,
                    animation: 'fadeInUp 0.3s ease-out'
                  }}
                >
                  {/* Floating horizontal scrollbar */}
                  {showScrollbar && (
                    <div
                      className="custom-horizontal-scroll"
                      style={{ ...floatingScrollStyles }}
                      onScroll={(e) => {
                        const scrollLeft = e.target.scrollLeft
                        const centerViewport =
                          gridContainerRef?.current?.querySelector(
                            '.ag-center-cols-viewport'
                          )
                        if (centerViewport) {
                          centerViewport.scrollLeft = scrollLeft
                        }
                      }}
                    >
                      <div
                        style={{
                          width: gridRef.current?.api
                            ? gridContainerRef?.current?.querySelector(
                                '.ag-body-horizontal-scroll-viewport'
                              )?.scrollWidth ||
                              gridContainerRef?.current?.querySelector(
                                '.ag-header-viewport'
                              )?.scrollWidth ||
                              '100%'
                            : '100%',
                          height: '1px'
                        }}
                      />
                    </div>
                  )}
                  <BCPagination
                    page={data?.pagination?.page || paginationOptions.page || 1}
                    size={
                      data?.pagination?.size || paginationOptions.size || 10
                    }
                    total={data?.pagination?.total ?? data?.total_count ?? 0}
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
          </>
        )}

        {/* CSS for animation */}
        <style>{`
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateX(-50%) translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateX(-50%) translateY(0);
            }
          }
        `}</style>
      </BCBox>
    )
  }
)

BCGridViewer.displayName = 'BCGridViewer'
