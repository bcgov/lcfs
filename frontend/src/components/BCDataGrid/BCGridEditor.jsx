import BCBox from '@/components/BCBox'
import { BCGridBase } from '@/components/BCDataGrid/BCGridBase'
import { isEqual } from '@/utils/eventHandlers'
import { AgGridReact } from '@ag-grid-community/react'
import '@ag-grid-community/styles/ag-grid.css'
import '@ag-grid-community/styles/ag-theme-material.css'
import Papa from 'papaparse'
import PropTypes from 'prop-types'
import { useCallback, useEffect, useRef } from 'react'
import { v4 as uuid } from 'uuid'

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
  onRowEditingStopped,
  onCellValueChanged,
  onAction,
  ...props
}) => {
  const localRef = useRef(null)
  const ref = gridRef || localRef

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

  const handleOnRowEditingStopped = useCallback(
    async (params) => {
      if (params.data.modified && !params.data.deleted) {
        if (onRowEditingStopped) {
          onRowEditingStopped(params)
        }
      }
    },
    [onRowEditingStopped]
  )

  const handleOnCellValueChanged = useCallback(
    (params) => {
      if (!isEqual(params.oldValue, params.newValue)) {
        params.data.modified = true
      }
      if (onCellValueChanged) {
        onCellValueChanged(params)
      }
      params.api.refreshCells()
    },
    [onCellValueChanged]
  )

  const onFirstDataRendered = useCallback((params) => {
    params.api.startEditingCell({
      rowIndex: 0,
      colKey: params.api.getDisplayedCenterColumns()[0].colId
    })
  }, [])

  const onCellClicked = (params) => {
    if (
      params.column.colId === 'action' &&
      params.event.target.dataset.action &&
      onAction
    ) {
      onAction(params.event.target.dataset.action, params)
    }
  }

  return (
    <BCBox my={2} component="div" style={{ height: '100%', width: '100%' }}>
      <BCGridBase
        ref={ref}
        className="ag-theme-quartz"
        onRowEditingStopped={handleOnRowEditingStopped}
        onCellValueChanged={handleOnCellValueChanged}
        onFirstDataRendered={onFirstDataRendered}
        undoRedoCellEditing
        undoRedoCellEditingLimit={5}
        editType="fullRow"
        enableBrowserTooltips
        getRowId={(params) => params.data.id}
        onCellClicked={onCellClicked}
        {...props}
      />
    </BCBox>
  )
}

BCGridEditor.propTypes = {
  gridRef: PropTypes.shape({ current: PropTypes.instanceOf(AgGridReact) }),
  handlePaste: PropTypes.func,
  onAction: PropTypes.func,

  onRowEditingStopped: PropTypes.func,
  onCellValueChanged: PropTypes.func
}
