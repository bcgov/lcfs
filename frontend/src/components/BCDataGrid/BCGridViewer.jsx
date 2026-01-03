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
  useLayoutEffect,
  useMemo,
  useEffect,
  useRef,
  useState
} from 'react'
import {
  runOnNextFrame,
  getGridScrollInfo as getGridScrollInfoUtil,
  syncGridScrollPositions as syncGridScrollPositionsUtil,
  syncCustomScrollbarToGrid as syncCustomScrollbarToGridUtil
} from '@/components/BCDataGrid/floatingScrollbarUtils'
import {
  addFlexToColumns,
  getColumnMinWidthSum,
  relaxColumnMinWidths
} from '@/components/BCDataGrid/columnSizingUtils'

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
    const customScrollbarRef = useRef(null)
    const [isPaginationVisible, setIsPaginationVisible] = useState(true)
    const [isGridVisible, setIsGridVisible] = useState(true)
    const [showScrollbar, setShowScrollbar] = useState(false)
    const [containerWidth, setContainerWidth] = useState(null)
    const minWidthRelaxedRef = useRef(false)
    const syncingFromGridRef = useRef(false)
    const syncingFromCustomRef = useRef(false)
    const [scrollContentWidth, setScrollContentWidth] = useState(null)

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

    const getGridScrollInfo = useCallback(
      () => getGridScrollInfoUtil(gridContainerRef),
      [gridContainerRef]
    )

    const syncGridScrollPositions = useCallback(
      (scrollLeft) =>
        syncGridScrollPositionsUtil(gridContainerRef, scrollLeft),
      [gridContainerRef]
    )

    const syncCustomScrollbarToGrid = useCallback(
      (infoOverride) => {
        if (!showScrollbar || !customScrollbarRef.current) return
        syncingFromGridRef.current = true
        syncCustomScrollbarToGridUtil({
          gridContainerRef,
          customScrollbarRef,
          showScrollbar,
          infoOverride
        })
        runOnNextFrame(() => {
          syncingFromGridRef.current = false
        })
      },
      [gridContainerRef, customScrollbarRef, showScrollbar]
    )

    const updateScrollMetrics = useCallback(() => {
      const info = getGridScrollInfo()
      if (!info) return

      setScrollContentWidth((prev) =>
        prev === info.contentWidth ? prev : info.contentWidth
      )
    }, [getGridScrollInfo])

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
        if (content.scrollWidth > container.clientWidth) {
          updateScrollMetrics()
        }
      }
    }, [data, updateScrollMetrics])

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

    useEffect(() => {
      if (!showScrollbar) return
      updateScrollMetrics()

      const handleResize = () => updateScrollMetrics()
      window.addEventListener('resize', handleResize)

      let resizeObserver
      if (
        typeof ResizeObserver !== 'undefined' &&
        gridContainerRef.current
      ) {
        const target =
          gridContainerRef.current.querySelector('.ag-body-horizontal-scroll') ||
          gridContainerRef.current.querySelector('.ag-center-cols-container')

        if (target) {
          resizeObserver = new ResizeObserver(() => updateScrollMetrics())
          resizeObserver.observe(target)
        }
      }

      return () => {
        window.removeEventListener('resize', handleResize)
        resizeObserver?.disconnect()
      }
    }, [showScrollbar, updateScrollMetrics])

    useEffect(() => {
      if (!showScrollbar) return

      let rafId = null
      let listeners = []
      let handleGridScroll = null

      const tryAttach = () => {
        if (!gridContainerRef.current || !customScrollbarRef.current) {
          rafId = requestAnimationFrame(tryAttach)
          return
        }

        const info = getGridScrollInfo()
        if (!info) {
          rafId = requestAnimationFrame(tryAttach)
          return
        }

        const { centerViewport, horizontalViewport, headerViewport } = info

        handleGridScroll = () => {
          if (syncingFromCustomRef.current) return

          const latestInfo = getGridScrollInfo()
          syncCustomScrollbarToGrid(latestInfo ?? info)
        }

        listeners = [centerViewport, horizontalViewport, headerViewport]
          .filter(Boolean)
          .map((element) => {
            element.addEventListener('scroll', handleGridScroll, {
              passive: true
            })
            return element
          })

        handleGridScroll()
        updateScrollMetrics()
      }

      tryAttach()

      return () => {
        if (rafId) {
          cancelAnimationFrame(rafId)
        }
        listeners.forEach((element) => {
          if (handleGridScroll) {
            element.removeEventListener('scroll', handleGridScroll)
          }
        })
      }
    }, [showScrollbar, updateScrollMetrics, getGridScrollInfo, syncCustomScrollbarToGrid])

    useEffect(() => {
      if (!showScrollbar) return
      syncCustomScrollbarToGrid()
    }, [showScrollbar, isPaginationFloating, data, syncCustomScrollbarToGrid])

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

    useLayoutEffect(() => {
      const container = gridContainerRef.current
      if (!container) return

      const updateWidth = () => {
        const rect = container.getBoundingClientRect()
        const nextWidth = Math.floor(rect.width)
        setContainerWidth((prev) =>
          prev === nextWidth || Number.isNaN(nextWidth) ? prev : nextWidth
        )
      }

      updateWidth()

      let resizeObserver
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(updateWidth)
        resizeObserver.observe(container)
      }

      window.addEventListener('resize', updateWidth)
      return () => {
        window.removeEventListener('resize', updateWidth)
        resizeObserver?.disconnect()
      }
    }, [])

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
        requestAnimationFrame(() => {
          if (minWidthRelaxedRef.current) return
          relaxColumnMinWidths(params.api, params.columnApi, 50)
          minWidthRelaxedRef.current = true
        })
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

      // After initial sizing, reduce minWidth on all columns to allow user drag down to 50px
      // Preserve current widths to avoid visual jumps.
      if (minWidthRelaxedRef.current) return
      relaxColumnMinWidths(params.api, params.columnApi, 50)
      minWidthRelaxedRef.current = true
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
        },
        minWidth: 50
      }),
      []
    )

    const fallbackMinWidth = defaultColDef?.minWidth ?? defaultColDefParams.minWidth ?? 100
    const totalMinWidth = useMemo(
      () => getColumnMinWidthSum(columnDefs, fallbackMinWidth),
      [columnDefs, fallbackMinWidth]
    )
    const shouldFitColumns = useMemo(
      () => containerWidth !== null && totalMinWidth <= containerWidth,
      [containerWidth, totalMinWidth]
    )

    const transformedColumnDefs = useMemo(() => {
      if (!columnDefs) return columnDefs

      if (shouldFitColumns) {
        return addFlexToColumns(columnDefs).columnDefs
      }

      return columnDefs.map((col) => {
        const nextCol = { ...col }
        if (nextCol.flex != null) {
          delete nextCol.flex
        }
        if (nextCol.minWidth && !nextCol.width) {
          nextCol.width = nextCol.minWidth
        }
        return nextCol
      })
    }, [columnDefs, shouldFitColumns])

    // Compute defaultMinWidth from columnDefs so autoSizeStrategy uses proper initial widths
    // This prevents the "squished then expand" visual effect on page load
    const computedAutoSizeStrategy = useMemo(() => {
      if (!columnDefs || columnDefs.length === 0) {
        return { type: 'fitGridWidth', defaultMinWidth: 100, ...autoSizeStrategy }
      }

      // Find the minimum minWidth value from columnDefs (default to 100 if none set)
      const minWidths = columnDefs
        .filter((col) => col.minWidth)
        .map((col) => col.minWidth)

      // Use the minimum of all minWidths, or 100 as a fallback
      const defaultMinWidth =
        minWidths.length > 0 ? Math.min(...minWidths) : 100

      return { type: 'fitGridWidth', defaultMinWidth, ...autoSizeStrategy }
    }, [columnDefs, autoSizeStrategy])

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
          columnDefs={transformedColumnDefs}
          gridOptions={gridOptions}
          rowData={!isLoading && ((data && data[dataKey]) || [])}
          onGridReady={onGridReady}
          onSortChanged={handleSortChanged}
          onFilterChanged={handleFilterChanged}
          onFirstDataRendered={onFirstDataRendered}
          onRowClicked={onRowClicked}
          getRowId={getRowId}
          autoSizeStrategy={shouldFitColumns ? computedAutoSizeStrategy : null}
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
                      ref={customScrollbarRef}
                      style={{ ...floatingScrollStyles }}
                      onScroll={(e) => {
                        if (syncingFromGridRef.current) return
                        if (!customScrollbarRef.current) return

                        const customMax = Math.max(
                          customScrollbarRef.current.scrollWidth -
                            customScrollbarRef.current.clientWidth,
                          0
                        )
                        const ratio =
                          customMax > 0
                            ? customScrollbarRef.current.scrollLeft / customMax
                            : 0

                        const gridInfo = getGridScrollInfo()
                        const gridMax = gridInfo?.maxScrollLeft ?? 0

                        syncingFromCustomRef.current = true
                        syncGridScrollPositions(ratio * gridMax)
                        runOnNextFrame(() => {
                          syncingFromCustomRef.current = false
                        })
                      }}
                    >
                      <div
                        style={{
                          width:
                            scrollContentWidth ??
                            gridContainerRef?.current?.clientWidth ??
                            '100%',
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
