/* eslint-disable react-hooks/exhaustive-deps */
import BCBox from '@/components/BCBox'
import { BCGridBase } from '@/components/BCDataGrid/BCGridBase'
import { isEqual } from '@/utils/grid/eventHandlers'
import { AgGridReact } from '@ag-grid-community/react'
import '@ag-grid-community/styles/ag-grid.css'
import '@ag-grid-community/styles/ag-theme-material.css'
import '@ag-grid-community/styles/ag-theme-quartz.css'
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
import { Menu, MenuItem } from '@mui/material'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faCaretDown } from '@fortawesome/free-solid-svg-icons'
import BCModal from '@/components/BCModal'
import { useTranslation } from 'react-i18next'
import { BCAlert2 } from '@/components/BCAlert'
import { RequiredHeader } from '@/components/BCDataGrid/components'
import {
  addFlexToColumns,
  getColumnMinWidthSum,
  relaxColumnMinWidths
} from '@/components/BCDataGrid/columnSizingUtils'

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
  gridRef = useRef(null),
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
}) => {
  const localRef = useRef(null)
  const ref = gridRef || localRef
  const gridContainerRef = useRef(null)
  const pendingSavePromiseRef = useRef(null)
  const firstEditableColumnRef = useRef(null)
  const [anchorEl, setAnchorEl] = useState(null)
  const buttonRef = useRef(null)
  const { t } = useTranslation(['common'])
  const [showRequiredIndicator, setShowRequiredIndicator] = useState(false)
  const [containerWidth, setContainerWidth] = useState(null)
  const minWidthRelaxedRef = useRef(false)

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
      return { type: 'fitGridWidth', defaultMinWidth: 100 }
    }

    // Find the minimum minWidth value from columnDefs (default to 100 if none set)
    const minWidths = columnDefs
      .filter((col) => col.minWidth)
      .map((col) => col.minWidth)

    // Use the minimum of all minWidths, or 100 as a fallback
    const defaultMinWidth =
      minWidths.length > 0 ? Math.min(...minWidths) : 100

    return { type: 'fitGridWidth', defaultMinWidth }
  }, [columnDefs])

  const handleGridReady = useCallback(
    (params) => {
      if (!showRequiredIndicator) {
        const actualCols = params.api.getColumnDefs() || []
        const foundRequired = actualCols.some(
          (colDef) => colDef.headerComponent === RequiredHeader
        )
      if (foundRequired) {
        setShowRequiredIndicator(true)
      }
    }

      requestAnimationFrame(() => {
        if (minWidthRelaxedRef.current) return
        relaxColumnMinWidths(params.api, params.columnApi, 50)
        minWidthRelaxedRef.current = true
      })

      props.onGridReady?.(params)
    },
    [showRequiredIndicator, props.onGridReady]
  )

  // Expand columns to fill grid and reduce minWidth to allow user drag down to 50px
  const handleFirstDataRendered = useCallback(
    (params) => {
      // After initial sizing, reduce minWidth on all columns to allow user drag down to 50px
      // Preserve current widths to avoid visual jumps.
      if (minWidthRelaxedRef.current) return
      relaxColumnMinWidths(params.api, params.columnApi, 50)
      minWidthRelaxedRef.current = true

      props.onFirstDataRendered?.(params)
    },
    [props.onFirstDataRendered]
  )

  const findFirstEditableColumn = useCallback(() => {
    if (!ref.current?.api) return null

    if (!firstEditableColumnRef.current) {
      const columns = ref.current.api.getAllDisplayedColumns()
      firstEditableColumnRef.current = columns.find(
        (col) =>
          col.colDef.editable !== false &&
          !['action', 'checkbox'].includes(col.colDef.field)
      )
    }
    return firstEditableColumnRef.current
  }, [])

  // Helper function to start editing first editable cell in a row
  const startEditingFirstEditableCell = useCallback(
    (rowIndex) => {
      if (!ref.current?.api) return

      // Ensure we have the first editable column
      const firstEditableColumn = findFirstEditableColumn()
      if (!firstEditableColumn) return

      // Use setTimeout to ensure the grid is ready
      setTimeout(() => {
        ref.current.api.ensureIndexVisible(rowIndex)
        ref.current.api.setFocusedCell(rowIndex, firstEditableColumn.getColId())
        ref.current.api.startEditingCell({
          rowIndex,
          colKey: firstEditableColumn.getColId()
        })
      }, 100)
    },
    [findFirstEditableColumn]
  )

  const handleExcelPaste = useCallback(
    (params) => {
      const newData = []
      const clipboardData = params.clipboardData || window.clipboardData
      const pastedData = clipboardData.getData('text/plain')
      const headerRow = ref.current.api
        .getAllDisplayedColumns()
        .map((column) => column.colDef.field)
        .filter((col) => col)
        .join('\t')
      const parsedData = Papa.parse(headerRow + '\n' + pastedData, {
        delimiter: '\t',
        header: true,
        transform: (value) => {
          const num = Number(value) // Attempt to convert to a number if possible
          return isNaN(num) ? value : num // Return the number if valid, otherwise keep as string
        },
        skipEmptyLines: true
      })
      if (parsedData.data.length < 0 || parsedData.data[1].length < 2) {
        return
      }
      parsedData.data.forEach((row) => {
        const newRow = { ...row }
        newRow.id = uuid()
        newData.push(newRow)
      })
      const transactions = ref.current.api.applyTransaction({ add: newData })
      // Trigger onCellEditingStopped event to update the row in backend.
      transactions.add.forEach((node) => {
        onCellEditingStopped({
          node,
          oldValue: '',
          newValue: node.data[findFirstEditableColumn()],
          ...props
        })
      })
    },
    [findFirstEditableColumn, onCellEditingStopped, props, ref]
  )

  useEffect(() => {
    const pasteHandler = (event) => {
      const gridApi = ref.current?.api
      const columnApi = ref.current?.columnApi

      if (handlePaste) {
        handlePaste(event, { api: gridApi, columnApi })
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

  const handleOnCellEditingStopped = useCallback(
    (params) => {
      if (params.data.modified && !params.data.deleted) {
        if (onCellEditingStopped) {
          let trackedPromise
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
    (params) => {
      if (!isEqual(params.oldValue, params.newValue)) {
        params.data.modified = true
      }
      if (onCellValueChanged) {
        onCellValueChanged(params)
      }
    },
    [onCellValueChanged]
  )

  const onCellClicked = async (params) => {
    if (
      params.column.colId === 'action' &&
      params.event.target.dataset.action &&
      onAction
    ) {
      const action = params.event.target.dataset.action
      const transaction = await onAction(action, params)

      // Apply the transaction if it exists
      if (transaction?.add?.length > 0) {
        const res = ref.current.api.applyTransaction(transaction)

        // Focus and edit the first editable column of the added rows
        if (res.add && res.add.length > 0) {
          const firstNewRow = res.add[0]
          startEditingFirstEditableCell(firstNewRow.rowIndex)
        }
      }
    }
  }
  const onCellFocused = (params) => {
    if (params.column) {
      const COLUMN_BUFFER = 20
      const { left, right } = params.api.getHorizontalPixelRange()
      const columnRight = params.column.left + params.column.actualWidth
      if (
        params.column.left < left + COLUMN_BUFFER ||
        columnRight > right - COLUMN_BUFFER
      ) {
        params.api.ensureColumnVisible(params.column, 'middle')
      }
    }
  }

  const handleAddRowsClick = (event) => {
    setAnchorEl(event.currentTarget)
  }

  const handleAddRowsClose = () => {
    setAnchorEl(null)
  }

  const handleAddRowsInternal = useCallback(
    async (numRows) => {
      let newRows = []

      if (onAction) {
        try {
          for (let i = 0; i < numRows; i++) {
            const transaction = await onAction('add')
            if (transaction?.add?.length > 0) {
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
          .fill()
          .map(() => ({ id: uuid() }))
      }

      // Apply the new rows to the grid
      const result = ref.current.api.applyTransaction({
        add: newRows,
        addIndex: ref.current.api.getDisplayedRowCount()
      })

      // Focus the first editable cell in the first new row
      if (result.add && result.add.length > 0) {
        startEditingFirstEditableCell(result.add[0].rowIndex)
      }

      setAnchorEl(null)
    },
    [onAction, startEditingFirstEditableCell]
  )

  const isGridValid = () => {
    let isValid = true

    ref.current.api.forEachNode((node) => {
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
