import BCAlert, { FloatingAlert } from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import { BCGridBase } from '@/components/BCDataGrid/BCGridBase'
import {
  AccessibleHeader,
  BCPagination
} from '@/components/BCDataGrid/components'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-material.css'
import { FilterToolbar } from '@/components/FilterToolbar'
import {
  createAgGridFilterPills,
  type AgGridFilterModel,
  type FilterPillRenderer
} from '@/components/FilterToolbar/filterUtils'
import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useMemo,
  useEffect,
  useRef,
  useState
} from 'react'
import type { AgGridReact } from 'ag-grid-react'
import type { ChangeEvent, CSSProperties } from 'react'
import type {
  ColumnState,
  ColDef,
  ColGroupDef,
  FirstDataRenderedEvent,
  GridReadyEvent,
  ITooltipParams
} from 'ag-grid-community'
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
import type {
  BCPaginationFilter,
  BCPaginationOptions,
  BCSortOrder,
  BCGridRow,
  BCGridViewerProps
} from './types'

export type { BCGridViewerProps } from './types'

type AgGridFilterCondition = Omit<AgGridFilterModel, 'field'>

const isFilterRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isFilterValue = (
  value: unknown
): value is string | number | boolean | null =>
  value === null ||
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean'

const normalizeFilterValues = (value: unknown) => {
  const values = Array.isArray(value)
    ? value
    : isFilterValue(value)
      ? [value]
      : []
  return values.filter(isFilterValue)
}

const normalizeFilterCondition = (
  value: unknown
): AgGridFilterCondition | undefined => {
  if (!isFilterRecord(value)) return undefined

  const condition: AgGridFilterCondition = {}
  if (typeof value.filterType === 'string')
    condition.filterType = value.filterType
  if (typeof value.type === 'string') condition.type = value.type
  if (isFilterValue(value.filter)) condition.filter = value.filter
  if (isFilterValue(value.filterTo)) condition.filterTo = value.filterTo
  if (Array.isArray(value.values)) {
    condition.values = normalizeFilterValues(value.values)
  } else if (Array.isArray(value.filter)) {
    condition.values = normalizeFilterValues(value.filter)
  }
  if (typeof value.dateFrom === 'string' || value.dateFrom === null) {
    condition.dateFrom = value.dateFrom
  }
  if (typeof value.dateTo === 'string' || value.dateTo === null) {
    condition.dateTo = value.dateTo
  }
  if (value.operator === 'AND' || value.operator === 'OR') {
    condition.operator = value.operator
  }

  const conditions = Array.isArray(value.conditions)
    ? value.conditions
        .map(normalizeFilterCondition)
        .filter((entry): entry is AgGridFilterCondition => entry !== undefined)
    : []
  const condition1 = conditions[0] ?? normalizeFilterCondition(value.condition1)
  const condition2 = conditions[1] ?? normalizeFilterCondition(value.condition2)
  if (condition1) condition.condition1 = condition1
  if (condition2) condition.condition2 = condition2

  return condition
}

const normalizePaginationFilter = (
  filter: BCPaginationFilter
): AgGridFilterModel | undefined => {
  if (typeof filter.field !== 'string') return undefined
  const condition = normalizeFilterCondition(filter)
  return condition
    ? { field: filter.field, ...condition }
    : { field: filter.field }
}

// Styles for floating pagination
const floatingPaginationStyles = {
  width: 'max-content',
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

export const BCGridViewer = forwardRef<
  AgGridReact<BCGridRow>,
  BCGridViewerProps
>(
  (
    {
      gridRef: providedGridRef,
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
      filterToolbarConfig = {},
      onClearFilters,
      suppressMovableColumns = false,
      columnState: controlledColumnState,
      onColumnStateChange,
      ...props
    },
    _ref
  ) => {
    const localGridRef = useRef<AgGridReact<BCGridRow> | null>(null)
    const gridRef = providedGridRef ?? localGridRef
    const { data, error, isError, isLoading } = queryData || {}
    const hasInitializedFromCache = useRef(false)
    const previousGridKey = useRef(gridKey)
    const isRestoringFromCache = useRef(false)

    // Refs and state for floating pagination
    const paginationRef = useRef<HTMLDivElement | null>(null)
    const gridContainerRef = useRef<HTMLDivElement | null>(null)
    const customScrollbarRef = useRef<HTMLDivElement | null>(null)
    const [isPaginationVisible, setIsPaginationVisible] = useState(true)
    const [isGridVisible, setIsGridVisible] = useState(true)
    const [showScrollbar, setShowScrollbar] = useState(false)
    const [containerWidth, setContainerWidth] = useState<number | null>(null)
    const minWidthRelaxedRef = useRef(false)
    const [minWidthRelaxed, setMinWidthRelaxed] = useState(false)
    const syncingFromGridRef = useRef(false)
    const syncingFromCustomRef = useRef(false)
    const [scrollContentWidth, setScrollContentWidth] = useState<number | null>(
      null
    )
    const [activeFilters, setActiveFilters] = useState<BCPaginationFilter[]>(
      paginationOptions?.filters || []
    )

    const isPaginationFloating = !isPaginationVisible && isGridVisible

    useEffect(() => {
      const timeout = setTimeout(() => {
        setActiveFilters(paginationOptions?.filters || [])
      }, 50)
      return () => clearTimeout(timeout)
    }, [paginationOptions?.filters])

    const convertFilterModelToArray = useCallback(
      (filterModel: Record<string, unknown> = {}) => {
        const sanitizeValue = (value: unknown) => {
          if (typeof value === 'string') {
            return value.trim()
          }
          return value
        }

        const sanitizeArrayValues = (values: unknown) => {
          let asArray
          if (Array.isArray(values)) {
            asArray = values
          } else if (typeof values === 'string' && values.includes(',')) {
            asArray = values.split(',')
          } else if (values !== undefined && values !== null && values !== '') {
            asArray = [values]
          } else {
            asArray = []
          }

          return asArray
            .map(sanitizeValue)
            .filter((v) => v !== null && v !== undefined && v !== '')
        }

        const sanitizeCsvString = (value: unknown) => {
          if (typeof value !== 'string') {
            return value
          }

          const trimmed = value.trim()
          if (!trimmed) {
            return ''
          }

          if (!trimmed.includes(',')) {
            return trimmed
          }

          return trimmed
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean)
            .join(',')
        }

        const sanitizeDateValue = (
          value: unknown
        ): string | null | undefined => {
          if (value === null || value === undefined) return value
          if (typeof value !== 'string') {
            return undefined
          }
          const dateOnly = value.match(/^(\d{4}-\d{2}-\d{2})/)
          return dateOnly ? dateOnly[1] : value.trim()
        }

        return Object.entries(filterModel)
          .map(([field, value]) => {
            if (!value || typeof value !== 'object' || Array.isArray(value)) {
              return null
            }
            const filterConfig = value as Partial<
              Omit<AgGridFilterModel, 'field'>
            >
            const baseFilter = { field }

            if (filterConfig.filterType === 'set') {
              // For set filters, use the 'filter' array or 'values' array
              const values =
                filterConfig.values !== undefined
                  ? filterConfig.values
                  : filterConfig.filter || []
              const cleanValues = sanitizeArrayValues(values)
              if (!cleanValues.length) {
                return null
              }
              return {
                ...baseFilter,
                filterType: 'set',
                values: cleanValues
              }
            } else if (filterConfig.filterType === 'text') {
              // For text filters, skip if filter value is empty
              if (
                filterConfig.filter === undefined ||
                filterConfig.filter === null ||
                filterConfig.filter === ''
              ) {
                return null
              }
              const sanitizedFilter = sanitizeCsvString(filterConfig.filter)
              if (!sanitizedFilter) {
                return null
              }

              return {
                ...baseFilter,
                filterType: 'text',
                type: filterConfig.type,
                filter: sanitizedFilter
              }
            } else {
              // For other filter types, include all properties but clean empty values
              const cleanConfig = { ...filterConfig }
              if (cleanConfig.filter === '' || cleanConfig.filter === null) {
                return null
              }
              if (cleanConfig.filterType === 'date') {
                cleanConfig.type = cleanConfig.type || 'equals'
                cleanConfig.dateFrom = sanitizeDateValue(cleanConfig.dateFrom)
                cleanConfig.dateTo = sanitizeDateValue(cleanConfig.dateTo)
              }
              return {
                ...baseFilter,
                ...cleanConfig
              }
            }
          })
          .filter((filter): filter is AgGridFilterModel => filter !== null)
      },
      []
    )

    // Cache pagination options to sessionStorage
    const cachePaginationOptions = useCallback(
      (options: BCPaginationOptions) => {
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
    const getGridScrollInfo = useCallback(
      () => getGridScrollInfoUtil(gridContainerRef),
      [gridContainerRef]
    )

    const syncGridScrollPositions = useCallback(
      (scrollLeft: number) =>
        syncGridScrollPositionsUtil(gridContainerRef, scrollLeft),
      [gridContainerRef]
    )

    const syncCustomScrollbarToGrid = useCallback(
      (infoOverride?: ReturnType<typeof getGridScrollInfo>) => {
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

      let resizeObserver: ResizeObserver | undefined
      if (typeof ResizeObserver !== 'undefined' && gridContainerRef.current) {
        const target =
          gridContainerRef.current.querySelector(
            '.ag-body-horizontal-scroll'
          ) ||
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

      let rafId: number | null = null
      let listeners: Element[] = []
      let handleGridScroll: (() => void) | null = null

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
            if (!element) return null
            element.addEventListener('scroll', handleGridScroll, {
              passive: true
            })
            return element
          })
          .filter((element): element is Element => element !== null)

        handleGridScroll()
        updateScrollMetrics()
      }

      tryAttach()

      return () => {
        if (rafId !== null) {
          cancelAnimationFrame(rafId)
        }
        listeners.forEach((element) => {
          if (handleGridScroll) {
            element.removeEventListener('scroll', handleGridScroll)
          }
        })
      }
    }, [
      showScrollbar,
      updateScrollMetrics,
      getGridScrollInfo,
      syncCustomScrollbarToGrid
    ])

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

      let resizeObserver: ResizeObserver | undefined
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
      (params: GridReadyEvent<BCGridRow>) => {
        const filterState = JSON.parse(
          sessionStorage.getItem(`${gridKey ?? ''}-filter`) ?? 'null'
        )
        const restoredColumnState =
          controlledColumnState ??
          JSON.parse(
            sessionStorage.getItem(`${gridKey ?? ''}-column`) ?? 'null'
          )

        // Apply filters if they exist
        if (filterState) {
          // Set restoration flag to prevent filter change handler from interfering
          isRestoringFromCache.current = true
          params.api.setFilterModel(filterState)

          const filterArr = convertFilterModelToArray(filterState)
          setActiveFilters(filterArr)

          // Always update pagination with restored filters
          const updatedOptions = {
            ...paginationOptions,
            page: 1, // Reset to page 1 for new filters
            filters: filterArr
          }
          onPaginationChange(updatedOptions)
          if (enablePageCaching) {
            cachePaginationOptions(updatedOptions)
          }

          // Reset restoration flag after a brief delay to allow filter events to complete
          setTimeout(() => {
            isRestoringFromCache.current = false
          }, 100)
        }

        // Apply column state
        if (restoredColumnState) {
          params.api.applyColumnState({
            state: restoredColumnState,
            applyOrder: true
          })
        } else {
          // Apply sort orders from current pagination options
          const state: ColumnState[] = (
            paginationOptions.sortOrders ?? []
          ).flatMap((col: BCSortOrder) =>
            col.field && (col.direction === 'asc' || col.direction === 'desc')
              ? [{ colId: col.field, sort: col.direction as 'asc' | 'desc' }]
              : []
          )
          params.api.applyColumnState({ state, defaultState: { sort: null } })
        }
        requestAnimationFrame(() => {
          if (minWidthRelaxedRef.current) return
          relaxColumnMinWidths(params.api, undefined, 50)
          minWidthRelaxedRef.current = true
          setMinWidthRelaxed(true)
        })
      },
      [
        gridKey,
        enablePageCaching,
        paginationOptions,
        onPaginationChange,
        cachePaginationOptions,
        convertFilterModelToArray,
        controlledColumnState
      ]
    )

    const onFirstDataRendered = useCallback(
      (params: FirstDataRenderedEvent<BCGridRow>) => {
        params.api.hideOverlay()

        // After initial sizing, reduce minWidth on all columns to allow user drag down to 50px
        // Preserve current widths to avoid visual jumps.
        if (minWidthRelaxedRef.current) return
        relaxColumnMinWidths(params.api, undefined, 50)
        minWidthRelaxedRef.current = true
        setMinWidthRelaxed(true)
      },
      []
    )

    const handleChangePage = (_event: unknown, newPage: number) => {
      const updatedOptions = { ...paginationOptions, page: newPage + 1 }
      onPaginationChange(updatedOptions)
      if (enablePageCaching) {
        cachePaginationOptions(updatedOptions)
      }
    }

    const handleChangeRowsPerPage = (event: ChangeEvent<HTMLInputElement>) => {
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
      (grid: { api: import('ag-grid-community').GridApi<BCGridRow> }) => {
        // Skip filter change handling if we're currently restoring from cache
        if (isRestoringFromCache.current) {
          return
        }

        const gridFilters = grid.api.getFilterModel()
        const filterArr = convertFilterModelToArray(gridFilters)
        setActiveFilters(filterArr)

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
        cachePaginationOptions,
        convertFilterModelToArray
      ]
    )

    const persistColumnState = useCallback(
      (columnState: ColumnState[] | null | undefined) => {
        if (!columnState) return
        if (onColumnStateChange) {
          onColumnStateChange(columnState)
        } else {
          sessionStorage.setItem(
            `${gridKey}-column`,
            JSON.stringify(columnState)
          )
        }
      },
      [gridKey, onColumnStateChange]
    )

    const handleSortChanged = useCallback(() => {
      const columnState = gridRef.current?.api.getColumnState()
      const sortTemp = columnState
        ?.filter((col: ColumnState) => col.sort)
        .sort(
          (a: ColumnState, b: ColumnState) =>
            (a.sortIndex ?? 0) - (b.sortIndex ?? 0)
        )
        .flatMap((col: ColumnState) =>
          col.colId && (col.sort === 'asc' || col.sort === 'desc')
            ? [{ field: col.colId, direction: col.sort }]
            : []
        )

      const updatedOptions = {
        ...paginationOptions,
        sortOrders: sortTemp ?? []
      }
      onPaginationChange(updatedOptions)
      if (enablePageCaching) {
        cachePaginationOptions(updatedOptions)
      }
      persistColumnState(columnState)
    }, [
      onPaginationChange,
      paginationOptions,
      enablePageCaching,
      cachePaginationOptions,
      persistColumnState
    ])

    const handleColumnMoved = useCallback(
      (params: import('ag-grid-community').ColumnMovedEvent<BCGridRow>) => {
        if (params?.finished === false) return
        const api = params?.api ?? gridRef?.current?.api
        persistColumnState(api?.getColumnState?.())
      },
      [gridRef, persistColumnState]
    )

    const handleRemoveFilterPill = useCallback(
      (field: string, valueToRemove?: unknown) => {
        const api = gridRef?.current?.api
        if (!api) return
        const currentModel = { ...(api.getFilterModel() || {}) }
        const targetFilter = currentModel[field]
        if (!targetFilter) return

        const removeFromArray = (values: unknown[] = [], target: unknown) => {
          return values.filter(
            (value) =>
              value !== target &&
              value !== String(target) &&
              String(value) !== String(target)
          )
        }

        let updatedModel = null

        if (valueToRemove !== undefined) {
          if (targetFilter.filterType === 'set') {
            const sourceValues = Array.isArray(targetFilter.values)
              ? targetFilter.values
              : []
            const remainingValues = removeFromArray(sourceValues, valueToRemove)
            if (remainingValues.length > 0) {
              updatedModel = { ...targetFilter, values: remainingValues }
            }
          } else if (Array.isArray(targetFilter.filter)) {
            const remainingValues = removeFromArray(
              targetFilter.filter,
              valueToRemove
            )
            if (remainingValues.length > 0) {
              updatedModel = { ...targetFilter, filter: remainingValues }
            }
          } else if (
            typeof targetFilter.filter === 'string' &&
            targetFilter.filter.includes(',')
          ) {
            const splitValues = targetFilter.filter
              .split(',')
              .map((value: string) => value.trim())
              .filter(Boolean)
            const remainingValues = removeFromArray(splitValues, valueToRemove)
            if (remainingValues.length > 0) {
              updatedModel = {
                ...targetFilter,
                filter: remainingValues.join(',')
              }
            }
          }
        }

        if (updatedModel) {
          currentModel[field] = updatedModel
        } else {
          delete currentModel[field]
        }

        const nextModel =
          Object.keys(currentModel).length > 0 ? currentModel : null
        api.setFilterModel(nextModel)
        setActiveFilters(convertFilterModelToArray(nextModel || {}))
      },
      [gridRef, convertFilterModelToArray, activeFilters]
    )

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

    const fallbackMinWidth =
      defaultColDef?.minWidth ?? defaultColDefParams.minWidth ?? 100
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
        const flexDefs = addFlexToColumns(columnDefs).columnDefs
        if (!minWidthRelaxed) {
          return flexDefs
        }
        return flexDefs.map((col: ColDef<BCGridRow>) => ({
          ...col,
          minWidth: 50
        }))
      }

      return columnDefs.map((col: ColDef<BCGridRow>) => {
        const nextCol = { ...col }
        if (nextCol.flex != null) {
          delete nextCol.flex
        }
        if (!minWidthRelaxed && nextCol.minWidth && !nextCol.width) {
          nextCol.width = nextCol.minWidth
        }
        if (minWidthRelaxed) {
          nextCol.minWidth = 50
        }
        return nextCol
      })
    }, [columnDefs, shouldFitColumns, minWidthRelaxed])

    // Compute defaultMinWidth from columnDefs so autoSizeStrategy uses proper initial widths
    // This prevents the "squished then expand" visual effect on page load
    const computedAutoSizeStrategy = useMemo(() => {
      if (!columnDefs || columnDefs.length === 0) {
        return {
          type: 'fitGridWidth',
          defaultMinWidth: 100,
          ...autoSizeStrategy
        }
      }

      // Find the minimum minWidth value from columnDefs (default to 100 if none set)
      const minWidths = columnDefs
        .filter((col: ColDef<BCGridRow>) => col.minWidth != null)
        .map((col: ColDef<BCGridRow>) => col.minWidth as number)

      // Use the minimum of all minWidths, or 100 as a fallback
      const defaultMinWidth =
        minWidths.length > 0 ? Math.min(...minWidths) : 100

      return { type: 'fitGridWidth', defaultMinWidth, ...autoSizeStrategy }
    }, [columnDefs, autoSizeStrategy])

    const { columnLabelLookup, columnPillRendererLookup } = useMemo(() => {
      const labelLookup: Record<string, string> = {}
      const pillLookup: Record<string, FilterPillRenderer> = {}
      type GridCol = (ColDef<BCGridRow> | ColGroupDef<BCGridRow>) & {
        filterPillRenderer?: FilterPillRenderer
      }
      const traverse = (cols: GridCol[] = []) => {
        cols.forEach((col: GridCol) => {
          if ('children' in col && col.children) {
            traverse(col.children)
            return
          }
          const leafColumn = col as ColDef<BCGridRow> & GridCol
          const key = leafColumn.field || leafColumn.colId
          if (key && leafColumn.headerName && !labelLookup[key]) {
            labelLookup[key] = leafColumn.headerName
          }
          const cellRenderer = leafColumn.cellRenderer
          const rendererPill =
            typeof cellRenderer === 'function'
              ? (
                  cellRenderer as typeof cellRenderer & {
                    filterPillRenderer?: FilterPillRenderer
                  }
                ).filterPillRenderer
              : undefined
          const pillRenderer = leafColumn.filterPillRenderer || rendererPill
          if (key && pillRenderer && !pillLookup[key]) {
            pillLookup[key] = pillRenderer
          }
        })
      }
      if (Array.isArray(columnDefs)) {
        traverse(columnDefs as GridCol[])
      }
      return {
        columnLabelLookup: labelLookup,
        columnPillRendererLookup: pillLookup
      }
    }, [columnDefs, activeFilters])

    const toolbarSelectFilters = filterToolbarConfig?.selectFilters || []
    const additionalPills = filterToolbarConfig?.additionalPills || []

    const gridFilterPills = useMemo(
      () =>
        createAgGridFilterPills({
          filters: activeFilters.flatMap((filter) => {
            const normalized = normalizePaginationFilter(filter)
            return normalized ? [normalized] : []
          }),
          columnLabelLookup,
          columnPillRenderers: columnPillRendererLookup,
          onRemove: handleRemoveFilterPill
        }),
      [
        activeFilters,
        columnLabelLookup,
        columnPillRendererLookup,
        handleRemoveFilterPill
      ]
    )

    const combinedPills = useMemo(
      () => [...(additionalPills || []), ...gridFilterPills],
      [additionalPills, gridFilterPills]
    )

    const hasAnyFiltersApplied = combinedPills.length > 0
    const shouldShowToolbar = useMemo(
      () => toolbarSelectFilters.length > 0 || combinedPills.length > 0,
      [toolbarSelectFilters, combinedPills, activeFilters]
    )

    const handleClearAllFilters = useCallback(() => {
      try {
        gridRef?.current?.api?.setFilterModel(null)
        gridRef?.current?.api?.setSortModel([])
        setActiveFilters([])
      } catch (error) {
        // no-op
      }
      onClearFilters?.()
    }, [gridRef, onClearFilters])

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
        {shouldShowToolbar && (
          <FilterToolbar
            selectFilters={toolbarSelectFilters}
            pills={combinedPills}
            onClearAll={handleClearAllFilters}
            clearAllDisabled={!hasAnyFiltersApplied}
            sx={{ mb: 2 }}
          />
        )}
        <BCGridBase
          ref={gridRef}
          className="ag-theme-material"
          loading={isLoading || loading}
          defaultColDef={{
            tooltipValueGetter: (params: ITooltipParams<BCGridRow>) => {
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
          onColumnMoved={handleColumnMoved}
          onRowClicked={onRowClicked}
          getRowId={getRowId}
          autoSizeStrategy={shouldFitColumns ? computedAutoSizeStrategy : null}
          suppressMovableColumns={suppressMovableColumns}
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
                      style={floatingScrollStyles as CSSProperties}
                      onScroll={(_event) => {
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
