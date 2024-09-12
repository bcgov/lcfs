import BCBox from '@/components/BCBox'
import { BCGridBase } from '@/components/BCDataGrid/BCGridBase'
import { isEqual } from '@/utils/eventHandlers'
import { AgGridReact } from '@ag-grid-community/react'
import '@ag-grid-community/styles/ag-grid.css'
import '@ag-grid-community/styles/ag-theme-material.css'
import Papa from 'papaparse'
import PropTypes from 'prop-types'
import { useCallback, useEffect, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import BCButton from '@/components/BCButton'
import { Menu, MenuItem } from '@mui/material'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faCaretDown } from '@fortawesome/free-solid-svg-icons'
import BCModal from '@/components/BCModal.jsx'
import { useTranslation } from 'react-i18next'

/**
 * @typedef {import('ag-grid-community').GridOptions} GridOptions
 * @typedef {import('react').MutableRefObject} MutableRefObject
 *
 * @typedef {Object} BCGridEditorProps
 * @property {React.Ref<any>} gridRef
 * @property {Function} handlePaste
 * @property {Function} onAction
 *
 * @param {BCGridEditorProps & GridOptions} props
 * @returns {JSX.Element}
 */
export const BCGridEditor = ({
  gridRef,
  handlePaste,
  onCellEditingStopped,
  onCellValueChanged,
  onAction,
  showAddRowsButton = true,
  saveButtonProps = {
    enabled: false
  },
  ...props
}) => {
  const localRef = useRef(null)
  const ref = gridRef || localRef
  const [anchorEl, setAnchorEl] = useState(null)
  const buttonRef = useRef(null)
  const { t } = useTranslation(['common'])

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
        skipEmptyLines: true
      })
      if (parsedData.data.length < 1 || parsedData.data[1].length < 2) {
        return
      }
      parsedData.data.forEach((row) => {
        const newRow = { ...row }
        newRow.id = uuid()
        newData.push(newRow)
      })
      ref.current.api.applyTransaction({ add: newData })
    },
    [ref]
  )

  useEffect(() => {
    window.addEventListener('paste', handlePaste || handleExcelPaste)
    return () => {
      window.removeEventListener('paste', handlePaste || handleExcelPaste)
    }
  }, [handleExcelPaste, handlePaste])

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

  const onCellClicked = (params) => {
    if (
      params.column.colId === 'action' &&
      params.event.target.dataset.action &&
      onAction
    ) {
      onAction(params.event.target.dataset.action, params)
    }
  }

  const handleAddRowsClick = (event) => {
    setAnchorEl(event.currentTarget)
  }

  const handleAddRowsClose = () => {
    setAnchorEl(null)
  }

  const handleAddRows = (numRows) => {
    const newRows = Array(numRows)
      .fill()
      .map(() => ({ id: uuid() }))
    ref.current.api.applyTransaction({ add: newRows })
    setAnchorEl(null)
  }

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

  return (
    <BCBox my={2} component="div" style={{ height: '100%', width: '100%' }}>
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
        {...props}
      />
      {showAddRowsButton && (
        <BCBox mt={2}>
          <BCButton
            ref={buttonRef}
            variant="outlined"
            color="dark"
            size="small"
            startIcon={<FontAwesomeIcon icon={faPlus} className="small-icon" />}
            endIcon={
              <FontAwesomeIcon icon={faCaretDown} className="small-icon" />
            }
            onClick={handleAddRowsClick}
          >
            Add row
          </BCButton>
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
            <MenuItem onClick={() => handleAddRows(1)}>1 row</MenuItem>
            <MenuItem onClick={() => handleAddRows(5)}>5 rows</MenuItem>
            <MenuItem onClick={() => handleAddRows(10)}>10 rows</MenuItem>
          </Menu>
        </BCBox>
      )}
      {saveButtonProps.enabled && (
        <>
          <BCButton
            onClick={onSaveExit}
            variant="contained"
            color="primary"
            style={{
              gap: 8,
              marginTop: 20
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
  )
}

BCGridEditor.propTypes = {
  gridRef: PropTypes.shape({ current: PropTypes.instanceOf(AgGridReact) }),
  handlePaste: PropTypes.func,
  onAction: PropTypes.func,
  onRowEditingStopped: PropTypes.func,
  onCellValueChanged: PropTypes.func,
  showAddRowsButton: PropTypes.bool
}
