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
import { useCallback, useEffect, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { Menu, MenuItem } from '@mui/material'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faCaretDown } from '@fortawesome/free-solid-svg-icons'
import BCModal from '@/components/BCModal'
import { useTranslation } from 'react-i18next'
import { BCAlert2 } from '@/components/BCAlert'

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
  gridRef,
  alertRef,
  enablePaste = true,
  handlePaste,
  onCellEditingStopped,
  onCellValueChanged,
  onAction,
  showAddRowsButton = true,
  addMultiRow = false,
  saveButtonProps = {
    enabled: false
  },
  onAddRows,
  ...props
}) => {
  const localRef = useRef(null)
  const ref = gridRef || localRef
  const firstEditableColumnRef = useRef(null)
  const [anchorEl, setAnchorEl] = useState(null)
  const buttonRef = useRef(null)
  const { t } = useTranslation(['common'])

  // Helper function to find and cache first editable column
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

  const handleOnCellEditingStopped = useCallback(
    async (params) => {
      if (params.data.modified && !params.data.deleted) {
        if (onCellEditingStopped) {
          onCellEditingStopped(params)
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
      alertRef.current.clearAlert()
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

  const handleAddRowsClick = (event) => {
    setAnchorEl(event.currentTarget)
  }

  const handleAddRowsClose = () => {
    setAnchorEl(null)
  }

  const handleAddRowsInternal = useCallback(
    async (numRows) => {
      alertRef.current.clearAlert()
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
  const onSaveExit = () => {
    const isValid = isGridValid()
    if (isValid) {
      saveButtonProps.onSave()
      return
    }

    setShowCloseModal(true)
  }
  const hasRequiredHeaderComponent = useCallback(() => {
    const columnDefs = ref.current?.api?.getColumnDefs() || []
    // Check if any column has `headerComponent` matching "RequiredHeader"
    return (
      columnDefs.some(
        (colDef) => colDef.headerComponent?.name === 'RequiredHeader'
      ) || columnDefs.some((colDef) => !!colDef.headerComponent)
    )
  }, [ref])

  return (
    <BCBox my={2} component="div" style={{ height: '100%', width: '100%' }}>
      {hasRequiredHeaderComponent() && (
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
        onCellValueChanged={handleOnCellValueChanged}
        undoRedoCellEditing
        undoRedoCellEditingLimit={5}
        enableBrowserTooltips
        getRowId={(params) => params.data.id}
        onCellClicked={onCellClicked}
        onCellEditingStopped={handleOnCellEditingStopped}
        autoHeight={true}
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
  gridRef: PropTypes.shape({ current: PropTypes.instanceOf(AgGridReact) }),
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
  })
}
