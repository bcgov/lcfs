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
import { v4 as uuid } from 'uuid'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faCaretDown } from '@fortawesome/free-solid-svg-icons'
import BCModal from '@/components/BCModal'
import { useTranslation } from 'react-i18next'
import { BCAlert2 } from '@/components/BCAlert'
import { RequiredHeader } from '@/components/BCDataGrid/components/Renderers/RequiredHeader'
import type {
  CellClickedEvent,
  CellEditingStoppedEvent,
  CellFocusedEvent,
  CellValueChangedEvent,
  Column,
  ColDef,
  GridReadyEvent,
  IRowNode
} from 'ag-grid-community'
import type { AgGridReact } from 'ag-grid-react'
import {
  addFlexToColumns,
  getColumnMinWidthSum,
  relaxColumnMinWidths
} from '@/components/BCDataGrid/columnSizingUtils'
import type { BCGridEditorProps, BCGridRow } from './types'

export type { BCGridEditorProps } from './types'

const getColumnDef = (column: Column<BCGridRow>): ColDef<BCGridRow> =>
  typeof column.getColDef === 'function'
    ? column.getColDef()
    : (column as unknown as { colDef: ColDef<BCGridRow> }).colDef

const getColumnId = (column: Column<BCGridRow>): string =>
  typeof column.getColId === 'function'
    ? column.getColId()
    : (getColumnDef(column).field ?? '')

/**
 * @typedef {import('ag-grid-community').GridOptions} GridOptions
 * @typedef {import('react').MutableRefObject} MutableRefObject
 *
 * @typedef {Object} BCGridEditorProps
 * @property {React.Ref<any>} gridRef
 * @property {Function} handlePaste
 * @property {Function} onAction
 * @property {Function} onAddRows
 *
 * @param {BCGridEditorProps & GridOptions} props
 * @returns {JSX.Element}
 */
export const BCGridEditor = ({
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
  defaultColDef,
  columnDefs,
  ...props
}: BCGridEditorProps) => {
  const localRef = useRef<AgGridReact<BCGridRow> | null>(null)
  const ref = gridRef || localRef
  const gridContainerRef = useRef<HTMLDivElement | null>(null)
  const pendingSavePromiseRef = useRef<Promise<unknown> | null>(null)
  const firstEditableColumnRef = useRef<Column<BCGridRow> | null>(null)
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const { t } = useTranslation(['common'])
  const [showRequiredIndicator, setShowRequiredIndicator] = useState(false)
  const [containerWidth, setContainerWidth] = useState<number | null>(null)
  const minWidthRelaxedRef = useRef(false)
  const [minWidthRelaxed, setMinWidthRelaxed] = useState(false)

  useEffect(() => {
    if (!showRequiredIndicator && columnDefs?.length) {
      const foundRequired = columnDefs.some(
        (colDef) => colDef.headerComponent === RequiredHeader
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

      requestAnimationFrame(() => {
        if (minWidthRelaxedRef.current) return
        relaxColumnMinWidths(params.api, undefined, 50)
        minWidthRelaxedRef.current = true
        setMinWidthRelaxed(true)
      })

      props.onGridReady?.(params)
    },
    [showRequiredIndicator, props.onGridReady]
  )

  // Expand columns to fill grid and reduce minWidth to allow user drag down to 50px
  const handleFirstDataRendered = useCallback(
    (params: import('ag-grid-community').FirstDataRenderedEvent<BCGridRow>) => {
      // After initial sizing, reduce minWidth on all columns to allow user drag down to 50px
      // Preserve current widths to avoid visual jumps.
      if (minWidthRelaxedRef.current) return
      relaxColumnMinWidths(params.api, undefined, 50)
      minWidthRelaxedRef.current = true
      setMinWidthRelaxed(true)

      props.onFirstDataRendered?.(params)
    },
    [props.onFirstDataRendered]
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

  // Helper function to start editing first editable cell in a row
  const startEditingFirstEditableCell = useCallback(
    (rowIndex: number) => {
      if (!ref.current?.api) return

      // Ensure we have the first editable column
      const firstEditableColumn = findFirstEditableColumn()
      if (!firstEditableColumn) return

      // Use setTimeout to ensure the grid is ready
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
    async (params: ClipboardEvent) => {
      const gridApi = ref.current?.api
      if (!gridApi) return

      const newData: BCGridRow[] = []
      const clipboardData = params.clipboardData
      if (!clipboardData) return
      const pastedData = clipboardData.getData('text/plain')
      const displayedColumns = gridApi.getAllDisplayedColumns()
      const editableColumns = displayedColumns.filter(
        (col) => getColumnDef(col).field && getColumnDef(col).field !== 'action'
      )
      const headerRow = editableColumns
        .map((column) => getColumnDef(column).field)
        .join('\t')
      const parsedData = Papa.parse(headerRow + '\n' + pastedData, {
        delimiter: '\t',
        header: true,
        transform: (value: string) => {
          if (value === '' || value == null) return value // Preserve empty values as-is
          const num = Number(value)
          return isNaN(num) ? value : num
        },
        skipEmptyLines: true
      })
      if (
        parsedData.data.length <= 0 ||
        Object.keys(parsedData.data[0]).length < 2
      ) {
        return
      }
      parsedData.data.forEach((row: BCGridRow) => {
        const newRow = { ...row }
        newRow.id = uuid()
        newRow.modified = true
        newData.push(newRow)
      })
      const transactions = gridApi.applyTransaction({ add: newData })

      // Build a proper params-like object for each pasted row so downstream
      // handlers (which expect AG Grid CellEditingStopped params) don't crash.
      const firstEditableCol = findFirstEditableColumn()
      const colDef = firstEditableCol
        ? getColumnDef(firstEditableCol)
        : {
            field: editableColumns[0]
              ? getColumnDef(editableColumns[0]).field
              : undefined
          }
      const field = colDef.field
      if (!field) return
      const column = firstEditableCol || editableColumns[0]

      // Save rows sequentially so each save completes before the next starts.
      // This prevents cache invalidation from wiping unsaved rows.
      for (const node of transactions?.add ?? []) {
        if (!onCellEditingStopped || !node.data) continue
        await onCellEditingStopped({
          node,
          data: node.data,
          oldValue: '',
          newValue: node.data[field],
          colDef,
          column,
          api: gridApi
        })
      }
    },
    [findFirstEditableColumn, onCellEditingStopped, ref]
  )

  useEffect(() => {
    const pasteHandler = (event: ClipboardEvent) => {
      const gridApi = ref.current?.api

      if (handlePaste) {
        handlePaste(event, { api: gridApi })
      } else {
        handleExcelPaste(event) // Fallback to the default paste function
      }
    }
    if (enablePaste) {
      window.addEventListener('paste', pasteHandler)
      return () => {
        window.removeEventListener('paste', pasteHandler)
      }
    }
  }, [handleExcelPaste, handlePaste, ref, enablePaste])

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

  const handleOnCellEditingStopped = useCallback(
    (params: CellEditingStoppedEvent<BCGridRow>) => {
      if (params.data?.modified && !params.data.deleted) {
        if (onCellEditingStopped) {
          let trackedPromise: Promise<void>
          const promise = Promise.resolve(onCellEditingStopped(params))
          trackedPromise = promise
            .catch((error) => {
              console.error('Error saving row:', error)
              throw error
            })
            .finally(() => {
              if (pendingSavePromiseRef.current === trackedPromise) {
                pendingSavePromiseRef.current = null
              }
            })

          pendingSavePromiseRef.current = trackedPromise
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
      const transaction = await onAction?.(action, params)

      // Apply the transaction if it exists
      if (transaction && transaction.add?.length) {
        const res = ref.current?.api.applyTransaction(transaction)

        // Focus and edit the first editable column of the added rows
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

  const handleAddRowsClick = (event: React.MouseEvent<HTMLButtonElement>) => {
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

      // Default logic if onAction doesn't return rows
      if (newRows.length === 0) {
        newRows = Array(numRows)
          .fill(undefined)
          .map(() => ({ id: uuid() }))
      }

      // Apply the new rows to the grid
      const result = ref.current?.api.applyTransaction({
        add: newRows,
        addIndex: ref.current.api.getDisplayedRowCount()
      })

      // Focus the first editable cell in the first new row
      if (result?.add?.length && result.add[0].rowIndex != null) {
        startEditingFirstEditableCell(result.add[0].rowIndex)
      }

      setAnchorEl(null)
    },
    [onAction, startEditingFirstEditableCell]
  )

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

  const waitForPendingSave = useCallback(async () => {
    if (pendingSavePromiseRef.current) {
      try {
        await pendingSavePromiseRef.current
      } catch (error) {
        console.error('Error saving row before navigation:', error)
        return false
      }
    }
    return true
  }, [])

  const onSaveExit = useCallback(async () => {
    const api = ref.current?.api
    if (typeof api?.stopEditing === 'function') {
      api.stopEditing()
    }

    const pendingSaveSucceeded = await waitForPendingSave()
    if (!pendingSaveSucceeded) {
      return
    }

    const isValid = isGridValid()
    if (isValid) {
      await saveButtonProps.onSave?.()
      return
    }

    setShowCloseModal(true)
  }, [isGridValid, ref, saveButtonProps.onSave, waitForPendingSave])

  return (
    <BCBox
      ref={gridContainerRef}
      my={2}
      component="div"
      style={{ height: '100%', width: '100%' }}
    >
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
        onFirstDataRendered={handleFirstDataRendered}
        autoHeight={true}
        autoSizeStrategy={shouldFitColumns ? computedAutoSizeStrategy : null}
        defaultColDef={{
          minWidth: 50,
          ...defaultColDef
        }}
        columnDefs={transformedColumnDefs}
        {...props}
      />
      <BCBox sx={{ height: '40px', margin: '15px 0', width: '100%' }}>
        <BCAlert2 dismissible={true} ref={alertRef} data-test="alert-box" />
      </BCBox>
      <BCBox flex={1}>
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
    </BCBox>
  )
}

BCGridEditor.propTypes = {
  gridRef: PropTypes.shape({ current: PropTypes.any }),
  alertRef: PropTypes.shape({ current: PropTypes.any }),
  handlePaste: PropTypes.func,
  onAction: PropTypes.func,
  onAddRows: PropTypes.func,
  onRowEditingStopped: PropTypes.func,
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
  defaultColDef: PropTypes.object,
  columnDefs: PropTypes.array
}
