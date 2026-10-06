/* eslint-disable react-hooks/exhaustive-deps */
import BCBox from '@/components/BCBox'
import { BCGridBase } from '@/components/BCDataGrid/BCGridBase'
import { isEqual } from '@/utils/grid/eventHandlers'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-material.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'
import Papa from 'papaparse'
import PropTypes from 'prop-types'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import type { CSSProperties, ChangeEvent, MouseEvent } from 'react'
import { v4 as uuid } from 'uuid'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faCaretDown } from '@fortawesome/free-solid-svg-icons'
import BCModal from '@/components/BCModal'
import { useTranslation } from 'react-i18next'
import { FloatingAlert } from '@/components/BCAlert'
import { RequiredHeader } from '@/components/BCDataGrid/components/Renderers/RequiredHeader'
import { AccessibleHeader } from '@/components/BCDataGrid/components/Renderers/AccessibleHeader'
import { BCPagination } from '@/components/BCDataGrid/components/StatusBar/BCPagination'
import {
  addFlexToColumns,
  getColumnMinWidthSum,
  relaxColumnMinWidths
} from '@/components/BCDataGrid/columnSizingUtils'
import {
  runOnNextFrame,
  getGridScrollInfo as getGridScrollInfoUtil,
  syncGridScrollPositions as syncGridScrollPositionsUtil,
  syncCustomScrollbarToGrid as syncCustomScrollbarToGridUtil
} from '@/components/BCDataGrid/floatingScrollbarUtils'
import type {
  BCGridEditorPaginatedProps,
  BCGridRow,
  BCPaginationOptions
} from './types'
import type { AgGridReact } from 'ag-grid-react'
import type {
  CellClickedEvent,
  CellFocusedEvent,
  CellValueChangedEvent,
  Column,
  ColumnState,
  ColDef,
  FirstDataRenderedEvent,
  GridReadyEvent,
  IRowNode
} from 'ag-grid-community'

export type { BCGridEditorPaginatedProps } from './types'

const getColumnDef = (column: Column<BCGridRow>): ColDef<BCGridRow> =>
  typeof column.getColDef === 'function'
    ? column.getColDef()
    : (column as unknown as { colDef: ColDef<BCGridRow> }).colDef

const getColumnId = (column: Column<BCGridRow>): string =>
  typeof column.getColId === 'function'
    ? column.getColId()
    : (getColumnDef(column).field ?? '')

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
  maxHeight: '4rem',
  position: 'relative',
  alignItems: 'center',
  '& .MuiTablePagination-toolbar p': { paddingTop: '0.1rem !important' }
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

const isIntersectionObserverSupported = () =>
  typeof window !== 'undefined' && 'IntersectionObserver' in window

/**
 * Hybrid Grid Editor with Pagination
 * Combines editing capabilities with server-side pagination
 *
 * @typedef {Object} BCGridEditorPaginatedProps
 * @property {React.Ref<any>} gridRef
 * @property {React.Ref<any>} alertRef
 * @property {Function} handlePaste
 * @property {Function} onAction
 * @property {Function} onAddRows
 * @property {Function} onCellEditingStopped
 * @property {Function} onCellValueChanged
 * @property {Object} paginationOptions - Current pagination state
 * @property {Function} onPaginationChange - Callback when pagination changes
 * @property {Object} queryData - Data object with pagination info
 * @property {string} dataKey - Key to access items in data object
 * @property {boolean} suppressPagination - Hide pagination controls
 * @property {string} gridKey - Unique key for caching
 * @property {boolean} enablePageCaching - Enable pagination state caching
 * @property {Array} paginationPageSizeSelector - Page size options
 * @property {boolean} enableFloatingPagination - Enable floating pagination
 */
export const BCGridEditorPaginated = ({
  gridRef = useRef<AgGridReact<BCGridRow> | null>(null),
  alertRef,
  enablePaste = true,
  handlePaste,
  onCellEditingStopped,
  onCellValueChanged,
  onAction,
  getRowId = (params) => params.data.id,
  showAddRowsButton = true,
  addMultiRow = false,
  saveButtonProps = {
    enabled: false
  },
  showMandatoryColumns = true,
  onAddRows,

  // Pagination props
  suppressPagination = false,
  gridKey,
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
  loading,
  defaultColDef,
  columnDefs,
  ...props
}: BCGridEditorPaginatedProps) => {
  const localRef = useRef<AgGridReact<BCGridRow> | null>(null)
  const ref = gridRef || localRef
  const firstEditableColumnRef = useRef<Column<BCGridRow> | null>(null)
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const { t } = useTranslation(['common'])
  const [showRequiredIndicator, setShowRequiredIndicator] = useState(false)

  // Pagination visibility refs and state
  const paginationRef = useRef<HTMLDivElement | null>(null)
  const gridContainerRef = useRef<HTMLDivElement | null>(null)
  const customScrollbarRef = useRef<HTMLDivElement | null>(null)
  const [isPaginationVisible, setIsPaginationVisible] = useState(true)
  const [isGridVisible, setIsGridVisible] = useState(true)
  const [showScrollbar, setShowScrollbar] = useState(false)
  const [containerWidth, setContainerWidth] = useState<number | null>(null)
  const syncingFromGridRef = useRef(false)
  const syncingFromCustomRef = useRef(false)
  const [scrollContentWidth, setScrollContentWidth] = useState<number | null>(
    null
  )
  const minWidthRelaxedRef = useRef(false)
  const [minWidthRelaxed, setMinWidthRelaxed] = useState(false)

  const hasInitializedFromCache = useRef(false)
  const previousGridKey = useRef(gridKey)
  const isRestoringFromCache = useRef(false)

  const { data, isLoading } = queryData || {}
  const isPaginationFloating = !isPaginationVisible && isGridVisible

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

  // Detect required fields
  useEffect(() => {
    if (!showRequiredIndicator && columnDefs?.length) {
      const foundRequired = columnDefs.some(
        (colDef) =>
          'headerComponent' in colDef &&
          colDef.headerComponent === RequiredHeader
      )
      if (foundRequired && showMandatoryColumns) {
        setShowRequiredIndicator(true)
      }
    }
  }, [columnDefs, showRequiredIndicator])

  const fallbackMinWidth = defaultColDef?.minWidth ?? 100
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

    return columnDefs.map((col) => {
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
      return { type: 'fitGridWidth', defaultMinWidth: 100 }
    }

    // Find the minimum minWidth value from columnDefs (default to 100 if none set)
    const minWidths = columnDefs
      .filter((col) => col.minWidth)
      .map((col: ColDef<BCGridRow>) => col.minWidth as number)

    // Use the minimum of all minWidths, or 100 as a fallback
    const defaultMinWidth = minWidths.length > 0 ? Math.min(...minWidths) : 100

    return { type: 'fitGridWidth', defaultMinWidth }
  }, [columnDefs])

  // Expand columns to fill grid and reduce minWidth to allow user drag down to 50px
  const handleFirstDataRendered = useCallback(
    (params: FirstDataRenderedEvent<BCGridRow>) => {
      // After initial sizing, reduce minWidth on all columns to allow user drag down to 50px
      // Preserve current widths to avoid visual jumps.
      if (minWidthRelaxedRef.current) return
      relaxColumnMinWidths(
        params.api,
        (
          params as FirstDataRenderedEvent<BCGridRow> & {
            columnApi?: unknown
          }
        ).columnApi,
        50
      )
      minWidthRelaxedRef.current = true
      setMinWidthRelaxed(true)

      props.onFirstDataRendered?.(params)
    },
    [props.onFirstDataRendered]
  )

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

  // Detect scrollbar need
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

  useEffect(() => {
    if (!showScrollbar) return
    updateScrollMetrics()

    const handleResize = () => updateScrollMetrics()
    window.addEventListener('resize', handleResize)

    let resizeObserver: ResizeObserver | undefined
    if (typeof ResizeObserver !== 'undefined' && gridContainerRef.current) {
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
          onPaginationChange?.(restoredOptions)
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

  // Intersection Observer for floating pagination
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

  const handleGridReady = useCallback(
    (params: GridReadyEvent<BCGridRow>) => {
      if (!showRequiredIndicator) {
        const actualCols = params.api.getColumnDefs() || []
        const foundRequired = actualCols.some(
          (colDef) =>
            'headerComponent' in colDef &&
            colDef.headerComponent === RequiredHeader
        )
        if (foundRequired) {
          setShowRequiredIndicator(true)
        }
      }

      // Restore filter and column state
      const filterState = JSON.parse(
        sessionStorage.getItem(`${gridKey ?? ''}-filter`) ?? 'null'
      )
      const columnState = JSON.parse(
        sessionStorage.getItem(`${gridKey ?? ''}-column`) ?? 'null'
      )

      if (filterState) {
        isRestoringFromCache.current = true
        params.api.setFilterModel(filterState)

        if (!enablePageCaching || !hasInitializedFromCache.current) {
          const filterArr = [
            ...Object.entries(filterState).map(([field, value]) => {
              return { field, ...(value as Record<string, unknown>) }
            })
          ]
          const updatedOptions = {
            ...paginationOptions,
            page: 1,
            filters: filterArr
          }
          onPaginationChange?.(updatedOptions)
          if (enablePageCaching) {
            cachePaginationOptions(updatedOptions)
          }
        }

        setTimeout(() => {
          isRestoringFromCache.current = false
        }, 100)
      }

      if (columnState) {
        params.api.applyColumnState({
          state: columnState,
          applyOrder: true
        })
      } else if ((paginationOptions.sortOrders?.length ?? 0) > 0) {
        const state: ColumnState[] = (
          paginationOptions.sortOrders ?? []
        ).flatMap((col) =>
          col.field && (col.direction === 'asc' || col.direction === 'desc')
            ? [{ colId: col.field, sort: col.direction as 'asc' | 'desc' }]
            : []
        )
        params.api.applyColumnState({
          state,
          defaultState: { sort: null }
        })
      }

      requestAnimationFrame(() => {
        if (minWidthRelaxedRef.current) return
        relaxColumnMinWidths(
          params.api,
          (
            params as GridReadyEvent<BCGridRow> & {
              columnApi?: unknown
            }
          ).columnApi,
          50
        )
        minWidthRelaxedRef.current = true
        setMinWidthRelaxed(true)
      })

      props.onGridReady?.(params)
    },
    [
      showRequiredIndicator,
      gridKey,
      enablePageCaching,
      paginationOptions,
      cachePaginationOptions
    ]
  )

  const findFirstEditableColumn = useCallback(() => {
    if (!ref.current?.api) return null

    if (!firstEditableColumnRef.current) {
      const columns = ref.current.api.getAllDisplayedColumns()
      firstEditableColumnRef.current =
        columns.find((col) => {
          const colDef = getColumnDef(col)
          return (
            colDef.editable !== false &&
            !['action', 'checkbox'].includes(colDef.field ?? '')
          )
        }) ?? null
    }
    return firstEditableColumnRef.current
  }, [])

  const startEditingFirstEditableCell = useCallback(
    (rowIndex: number) => {
      if (!ref.current?.api) return

      const firstEditableColumn = findFirstEditableColumn()
      if (!firstEditableColumn) return

      setTimeout(() => {
        const api = ref.current?.api
        if (!api) return
        api.ensureIndexVisible(rowIndex)
        api.setFocusedCell(rowIndex, getColumnId(firstEditableColumn))
        api.startEditingCell({
          rowIndex,
          colKey: getColumnId(firstEditableColumn)
        })
      }, 100)
    },
    [findFirstEditableColumn]
  )

  const handleExcelPaste = useCallback(
    (params: ClipboardEvent) => {
      const gridApi = ref.current!.api
      const newData: BCGridRow[] = []
      const clipboardData = (params.clipboardData ||
        (window as Window & { clipboardData?: DataTransfer })
          .clipboardData) as DataTransfer
      const pastedData = clipboardData.getData('text/plain')
      const headerRow = gridApi
        .getAllDisplayedColumns()
        .map((column) => getColumnDef(column).field)
        .filter((col) => col)
        .join('\t')
      const parsedData = Papa.parse(headerRow + '\n' + pastedData, {
        delimiter: '\t',
        header: true,
        transform: (value: string) => {
          const num = Number(value)
          return isNaN(num) ? value : num
        },
        skipEmptyLines: true
      })
      if (
        parsedData.data.length < 0 ||
        (parsedData.data as any[])[1].length < 2
      ) {
        return
      }
      parsedData.data.forEach((row: BCGridRow) => {
        const newRow = { ...row }
        newRow.id = uuid()
        newData.push(newRow)
      })
      const transactions = gridApi.applyTransaction({ add: newData })
      transactions?.add?.forEach((node) => {
        if (!onCellEditingStopped || !node.data) return
        onCellEditingStopped({
          node,
          data: node.data,
          oldValue: '',
          newValue:
            node.data[
              findFirstEditableColumn()
                ? getColumnId(findFirstEditableColumn()!)
                : ''
            ],
          api: gridApi
        })
      })
    },
    [findFirstEditableColumn, onCellEditingStopped, props, ref]
  )

  useEffect(() => {
    const pasteHandler = (event: ClipboardEvent) => {
      const gridApi = ref.current?.api
      const columnApi = (
        ref.current as
          | (AgGridReact<BCGridRow> & {
              columnApi?: unknown
            })
          | null
      )?.columnApi

      if (handlePaste) {
        handlePaste(event, { api: gridApi, columnApi })
      } else {
        handleExcelPaste(event)
      }
    }
    if (enablePaste) {
      window.addEventListener('paste', pasteHandler)
      return () => {
        window.removeEventListener('paste', pasteHandler)
      }
    }
  }, [handleExcelPaste, handlePaste, ref, enablePaste])

  const handleOnCellEditingStopped = useCallback(
    async (
      params: import('ag-grid-community').CellEditingStoppedEvent<BCGridRow>
    ) => {
      if (params.data?.modified && !params.data.deleted) {
        if (onCellEditingStopped) {
          onCellEditingStopped(params)
        }
      }
    },
    [onCellEditingStopped]
  )

  const handleOnCellValueChanged = useCallback(
    (params: CellValueChangedEvent<BCGridRow>) => {
      if (!isEqual(params.oldValue, params.newValue)) {
        params.data.modified = true
      }
      if (onCellValueChanged) {
        onCellValueChanged(params)
      }
    },
    [onCellValueChanged]
  )

  const onCellClicked = async (params: CellClickedEvent<BCGridRow>) => {
    if (
      params.column.getColId() === 'action' &&
      params.event?.target instanceof HTMLElement &&
      params.event.target.dataset.action &&
      onAction
    ) {
      const action = (params.event?.target as HTMLElement).dataset.action
      if (!action) return
      const transaction = await onAction(action, params)

      if (transaction && transaction.add?.length) {
        const res = ref.current?.api.applyTransaction(transaction)

        if (res?.add?.length) {
          const firstNewRow = res.add[0]
          if (firstNewRow.rowIndex != null)
            startEditingFirstEditableCell(firstNewRow.rowIndex)
        }
      }
    }
  }

  const onCellFocused = (params: CellFocusedEvent<BCGridRow>) => {
    if (params.column && typeof params.column !== 'string') {
      const COLUMN_BUFFER = 20
      const { left, right } = params.api.getHorizontalPixelRange()
      const columnLeft = params.column.getLeft() ?? 0
      const columnRight = columnLeft + params.column.getActualWidth()
      if (
        columnLeft < left + COLUMN_BUFFER ||
        columnRight > right - COLUMN_BUFFER
      ) {
        params.api.ensureColumnVisible(params.column, 'middle')
      }
    }
  }

  const handleAddRowsClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleAddRowsClose = () => {
    setAnchorEl(null)
  }

  const handleAddRowsInternal = useCallback(
    async (numRows: number) => {
      let newRows: BCGridRow[] = []

      if (onAction) {
        try {
          for (let i = 0; i < numRows; i++) {
            const transaction = await onAction('add')
            if (transaction && transaction.add?.length) {
              newRows = [...newRows, ...transaction.add]
            }
          }
        } catch (error) {
          console.error('Error during onAction add:', error)
        }
      }

      if (newRows.length === 0) {
        newRows = Array(numRows)
          .fill(undefined)
          .map(() => ({ id: uuid() }))
      }

      const result = ref.current?.api.applyTransaction({
        add: newRows,
        addIndex: ref.current.api.getDisplayedRowCount()
      })

      if (result?.add?.length && result.add[0].rowIndex != null) {
        startEditingFirstEditableCell(result.add[0].rowIndex)
      }

      setAnchorEl(null)
    },
    [onAction, startEditingFirstEditableCell]
  )

  // Pagination handlers
  const handleChangePage = (_event: unknown, newPage: number) => {
    const updatedOptions = { ...paginationOptions, page: newPage + 1 }
    onPaginationChange?.(updatedOptions)
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
    onPaginationChange?.(updatedOptions)
    if (enablePageCaching) {
      cachePaginationOptions(updatedOptions)
    }
  }

  const handleFilterChanged = useCallback(
    (grid: { api: import('ag-grid-community').GridApi<BCGridRow> }) => {
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
        page: 1,
        filters: filterArr
      }
      onPaginationChange?.(updatedOptions)
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
    const sortTemp = ref.current?.api
      .getColumnState()
      .filter((col) => col.sort)
      .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
      .flatMap((col) =>
        col.colId && (col.sort === 'asc' || col.sort === 'desc')
          ? [{ field: col.colId, direction: col.sort }]
          : []
      )

    const updatedOptions = { ...paginationOptions, sortOrders: sortTemp ?? [] }
    onPaginationChange?.(updatedOptions)
    if (enablePageCaching) {
      cachePaginationOptions(updatedOptions)
    }
    sessionStorage.setItem(
      `${gridKey}-column`,
      JSON.stringify(ref.current?.api.getColumnState())
    )
  }, [
    gridKey,
    onPaginationChange,
    paginationOptions,
    enablePageCaching,
    cachePaginationOptions
  ])

  const isGridValid = () => {
    let isValid = true

    ref.current?.api.forEachNode((node: IRowNode<BCGridRow>) => {
      if (!node.data || node.data.validationStatus === 'error') {
        isValid = false
      }
    })

    return isValid
  }

  const [showCloseModal, setShowCloseModal] = useState(false)
  const onSaveExit = () => {
    const isValid = isGridValid()
    if (isValid) {
      saveButtonProps.onSave?.()
      return
    }

    setShowCloseModal(true)
  }

  const defaultColDefParams = {
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
  }

  return (
    <BCBox
      ref={gridContainerRef}
      my={2}
      component="div"
      sx={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <FloatingAlert dismissible={true} ref={alertRef} data-test="alert-box" />
      {showRequiredIndicator && (
        <BCTypography
          variant="body4"
          color="text"
          component="div"
          dangerouslySetInnerHTML={{ __html: t('asterisk') }}
        />
      )}
      <BCGridBase
        ref={ref}
        className="ag-theme-quartz"
        onGridReady={handleGridReady}
        onCellValueChanged={handleOnCellValueChanged}
        undoRedoCellEditing
        undoRedoCellEditingLimit={5}
        enableBrowserTooltips
        getRowId={getRowId}
        onCellClicked={onCellClicked}
        onCellEditingStopped={handleOnCellEditingStopped}
        onCellFocused={onCellFocused}
        onSortChanged={handleSortChanged}
        onFilterChanged={handleFilterChanged}
        onFirstDataRendered={handleFirstDataRendered}
        autoHeight={false}
        autoSizeStrategy={shouldFitColumns ? computedAutoSizeStrategy : null}
        loading={isLoading || loading}
        rowData={!isLoading && ((data && data[dataKey]) || [])}
        defaultColDef={{
          ...defaultColDefParams,
          ...defaultColDef
        }}
        enableCellTextSelection={true}
        columnDefs={transformedColumnDefs}
        {...props}
      />

      {/* Pagination Controls */}
      {!suppressPagination && (
        <>
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
              gridRef={ref}
              rowsPerPageOptions={paginationPageSizeSelector}
            />
          </BCBox>

          {/* Floating pagination */}
          {isPaginationFloating &&
            enableFloatingPagination &&
            (data?.pagination?.size || paginationOptions.size || 10) > 10 &&
            (data?.pagination?.total || paginationOptions.total || 10) > 10 && (
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
                  size={data?.pagination?.size || paginationOptions.size || 10}
                  total={data?.pagination?.total ?? data?.total_count ?? 0}
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
        </>
      )}

      {/* Action Buttons */}
      <BCBox flex={1} mt={2} mx={0} ml={-2}>
        {showAddRowsButton && (
          <>
            <BCButton
              ref={buttonRef}
              variant="outlined"
              data-test="add-row-btn"
              color="dark"
              startIcon={
                <FontAwesomeIcon icon={faPlus} className="small-icon" />
              }
              endIcon={
                addMultiRow && (
                  <FontAwesomeIcon icon={faCaretDown} className="small-icon" />
                )
              }
              onClick={
                addMultiRow
                  ? handleAddRowsClick
                  : () => handleAddRowsInternal(1)
              }
            >
              Add row
            </BCButton>
            {addMultiRow && (
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleAddRowsClose}
                slotProps={{
                  paper: {
                    style: {
                      width: buttonRef.current?.offsetWidth
                    }
                  }
                }}
              >
                <MenuItem onClick={() => handleAddRowsInternal(1)}>
                  1 row
                </MenuItem>
                <MenuItem onClick={() => handleAddRowsInternal(5)}>
                  5 rows
                </MenuItem>
                <MenuItem onClick={() => handleAddRowsInternal(10)}>
                  10 rows
                </MenuItem>
              </Menu>
            )}
          </>
        )}
        {saveButtonProps.enabled && (
          <>
            <BCButton
              onClick={onSaveExit}
              variant="contained"
              data-test="save-btn"
              color="primary"
              style={{
                marginLeft: 20
              }}
            >
              {saveButtonProps.text}
            </BCButton>
            <BCModal
              open={showCloseModal}
              onClose={() => {
                setShowCloseModal(false)
              }}
              data={{
                title: saveButtonProps.text,
                content: saveButtonProps.confirmText,
                primaryButtonAction: saveButtonProps.onSave,
                primaryButtonText: saveButtonProps.confirmLabel,
                secondaryButtonText: t('cancelBtn')
              }}
            />
          </>
        )}
      </BCBox>

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

BCGridEditorPaginated.propTypes = {
  gridRef: PropTypes.shape({ current: PropTypes.any }),
  alertRef: PropTypes.shape({ current: PropTypes.any }),
  handlePaste: PropTypes.func,
  onAction: PropTypes.func,
  onAddRows: PropTypes.func,
  onCellEditingStopped: PropTypes.func,
  onCellValueChanged: PropTypes.func,
  showAddRowsButton: PropTypes.bool,
  addMultiRow: PropTypes.bool,
  saveButtonProps: PropTypes.shape({
    enabled: PropTypes.bool,
    text: PropTypes.string,
    onSave: PropTypes.func,
    confirmText: PropTypes.string,
    confirmLabel: PropTypes.string
  }),
  onGridReady: PropTypes.func,
  suppressPagination: PropTypes.bool,
  gridKey: PropTypes.string,
  paginationOptions: PropTypes.shape({
    page: PropTypes.number,
    size: PropTypes.number,
    sortOrders: PropTypes.array,
    filters: PropTypes.array
  }),
  onPaginationChange: PropTypes.func,
  queryData: PropTypes.object,
  dataKey: PropTypes.string,
  enableExportButton: PropTypes.bool,
  enableCopyButton: PropTypes.bool,
  enableResetButton: PropTypes.bool,
  enablePageCaching: PropTypes.bool,
  paginationPageSizeSelector: PropTypes.array,
  exportName: PropTypes.string,
  enableFloatingPagination: PropTypes.bool,
  loading: PropTypes.bool
}
