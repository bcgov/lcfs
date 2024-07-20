import BCBox from '@/components/BCBox'
import { BCGridBase } from '@/components/BCDataGrid/BCGridBase'
import {
  ActionsRenderer,
  AsyncSuggestionEditor,
  AsyncValidationEditor,
  AutocompleteEditor,
  DateEditor,
  DateRangeCellEditor,
  HeaderComponent,
  LargeTextareaEditor,
  TextCellEditor,
  ValidationRenderer
} from '@/components/BCDataGrid/components'
import { isEqual } from '@/utils/eventHandlers'
import '@ag-grid-community/styles/ag-grid.css'
import '@ag-grid-community/styles/ag-theme-material.css'
import Papa from 'papaparse'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { v4 as uuid } from 'uuid'

export const BCGridEditor = ({
  statusBarComponent,
  handlePaste,
  onRowEditingStarted,
  onRowEditingStopped,
  onValidated,
  saveRow,
  gridOptions,
  columnDefs,
  defaultColDef,
  rowData,
  onGridReady,
  loading,
  gridRef,
  ...props
}) => {
  const localRef = useRef(null)
  const ref = gridRef || localRef

  const components = useMemo(
    () => ({
      asyncValidationEditor: AsyncValidationEditor,
      autocompleteEditor: AutocompleteEditor,
      dateEditor: DateEditor,
      actionsRenderer: ActionsRenderer,
      asyncSuggestionEditor: AsyncSuggestionEditor,
      validationRenderer: ValidationRenderer,
      dateRangeCellEditor: DateRangeCellEditor,
      largeTextareaEditor: LargeTextareaEditor,
      textCellEditor: TextCellEditor,
      headerComponent: HeaderComponent
    }),
    []
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

  const tabToNextCell = useCallback((params) => params.nextCellPosition, [])

  const onRowEditingStartedHandler = useCallback(
    (params) => {
      params.api.refreshCells({
        columns: ['action'],
        rowNodes: [params.node],
        force: true
      })
      if (onRowEditingStarted) {
        onRowEditingStarted(params)
      }
    },
    [onRowEditingStarted]
  )

  const onRowEditingStoppedHandler = useCallback(
    (params) => {
      // Check if any data field has changed
      if (params.data.modified && !params.data.deleted) {
        onValidated('pending', 'Updating row...')
        saveRow(params.data, {
          onSuccess: (resp) => {
            params.data.modified = false
            params.data.isValid = true
            if (onValidated) {
              onValidated('success', 'Row updated successfully.', params, resp)
            }
            params.api.refreshCells()
          },
          onError: (error) => {
            params.data.isValid = false
            params.api.refreshCells()
            if (onValidated) {
              if (error.code === 'ERR_BAD_REQUEST') {
                onValidated('error', error, params)
                // errMsg = `Error updating row: ${error.response?.data?.detail[0]?.loc[1].replace(/([A-Z])/g, ' $1').trim()}  ${error.response?.data?.detail[0]?.msg}`
              } else {
                onValidated('error', `Error updating row: ${error.message}`)
              }
            }
          }
        })
      }

      params.api.redrawRows({ rowNodes: [params.node] })

      if (onRowEditingStopped) {
        onRowEditingStopped(params)
      }
    },
    [onRowEditingStopped, onValidated, saveRow]
  )

  const onCellValueChanged = useCallback((params) => {
    if (!isEqual(params.oldValue, params.newValue)) {
      params.data.modified = true
    }
  }, [])

  const onFirstDataRendered = useCallback((params) => {
    params.api.startEditingCell({
      rowIndex: 0,
      colKey: params.api.getDisplayedCenterColumns()[0].colId
    })
  }, [])

  return (
    <BCBox my={2} component="div" style={{ height: '100%', width: '100%' }}>
      <BCGridBase
        ref={ref}
        components={components}
        tabToNextCell={tabToNextCell}
        onRowEditingStarted={onRowEditingStartedHandler}
        onRowEditingStopped={onRowEditingStoppedHandler}
        onCellValueChanged={onCellValueChanged}
        onFirstDataRendered={onFirstDataRendered}
        undoRedoCellEditing
        undoRedoCellEditingLimit={5}
        editType="fullRow"
        enableBrowserTooltips
        gridOptions={gridOptions}
        className="ag-theme-quartz"
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        rowData={rowData}
        onGridReady={onGridReady}
        getRowId={(params) => params.data.id}
        loading={loading}
        {...props}
      />
      <BCBox
        display="flex"
        justifyContent="flex-start"
        variant="outlined"
        sx={{
          maxHeight: '4.5rem',
          position: 'relative',
          border: 'none',
          borderRadius: '0px 0px 4px 4px',
          overflow: 'hidden'
        }}
      >
        {statusBarComponent}
      </BCBox>
    </BCBox>
  )
}
