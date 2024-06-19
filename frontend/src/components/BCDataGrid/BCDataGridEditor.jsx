import { useMemo, useCallback, useEffect } from 'react'
import { AgGridReact } from '@ag-grid-community/react'
import { Stack } from '@mui/material'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'

import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import DataGridLoading from '@/components/DataGridLoading'
import {
  AutocompleteEditor,
  AsyncValidationEditor,
  DateEditor,
  ActionsRenderer,
  AsyncSuggestionEditor,
} from '@/components/BCDataGrid/components'
import Papa from 'papaparse'
import '@ag-grid-community/styles/ag-grid.css'
import '@ag-grid-community/styles/ag-theme-quartz.css'

const BCDataGridEditor = ({
  gridOptions,
  onGridReady,
  gridApi,
  columnApi,
  rowData,
  gridKey,
  getRowNodeId,
  gridRef,
  columnDefs,
  defaultColDef,
  highlightedRowId,
  className,
  defaultStatusBar,
  onRowEditingStarted,
  onRowEditingStopped,
  fieldsToNullOnDuplicate,
  saveRow,
  onValidated,
  ...props
}) => {
  const frameworkComponents = useMemo(() => ({
    asyncValidationEditor: AsyncValidationEditor,
    autocompleteEditor: AutocompleteEditor,
    dateEditor: DateEditor,
    actionsRenderer: ActionsRenderer,
    asyncSuggestionEditor: AsyncSuggestionEditor,
  }), [])

  const handleExcelPaste = useCallback(
    (params) => {
      const newData = []
      const pastedData = params.clipboardData.getData('text/plain')
      const headerRow = gridApi
        .getAllDisplayedColumns()
        .map((column) => column.colDef.field)
        .filter((col => col))
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
      gridApi.applyTransaction({ add: newData })
    },
    [gridApi]
  )

  useEffect(() => {
    window.addEventListener('paste', props.handlePaste || handleExcelPaste)
    return () => {
      window.removeEventListener('paste', props.handlePaste || handleExcelPaste)
    }
  }, [handleExcelPaste, props.handlePaste])

  const loadingOverlayComponent = useMemo(() => DataGridLoading, [])
  const tabToNextCell = useCallback((params) => params.nextCellPosition, [])
  const defaultGridOptions = useMemo(() => ({
    undoRedoCellEditing: true,
    undoRedoCellEditingLimit: 5,
    reactiveCustomComponents: true,
    overlayNoRowsTemplate: 'No rows found',
    autoSizeStrategy: { type: 'fitCellContents' },
    suppressDragLeaveHidesColumns: true,
    suppressMovableColumns: true,
    suppressColumnMoveAnimation: false,
    rowSelection: 'multiple',
    editType: 'fullRow',
    enableBrowserTooltips: true,
    rowHeight: 45,
    headerHeight: 40,
    animateRows: true,
    tabToNextCell,
    suppressPaginationPanel: true,
    suppressScrollOnNewData: true,
    suppressCsvExport: false,
    components: frameworkComponents,
    onFirstDataRendered: (params) => {
      params.api.startEditingCell({
        rowIndex: 0,
        colKey: params.api.getDisplayedCenterColumns()[0].colId,
      })
    },
    getRowStyle: highlightedRowId
      ? (params) => {
        if (params.node.id === highlightedRowId) {
          return { backgroundColor: '#fade81' }
        }
      }
      : undefined,
  }), [highlightedRowId, frameworkComponents, tabToNextCell])

  const addRow = useCallback(() => {
    const id = uuid()
    const emptyRow = { id }
    gridApi.applyTransaction({ add: [emptyRow] })
  }, [gridApi])
  
  const deleteRowHandler = useCallback((rowData) => {
    onValidated('pending', 'Deleting row...')
    const updatedData = { ...rowData, deleted: true }
    saveRow(updatedData, {
      onSuccess: (data) => {
        gridApi.applyTransaction({ remove: [rowData] })
        if (onValidated) {
          onValidated('success', 'Row deleted successfully.')
        }
      },
      onError: (error) => {
        if (onValidated) {
          onValidated('error', `Error deleting row: ${error.message}`)
        }
        console.error('Error deleting row:', error)
      }
    })
  }, [gridApi, saveRow, onValidated])

  const duplicateRowHandler = useCallback((rowData) => {
    onValidated('pending', 'Duplicating row...')
    const newData = { ...rowData, id: uuid(), duplicated: true }
    fieldsToNullOnDuplicate.forEach(field => {
      newData[field] = null
    })
    saveRow(newData, {
      onSuccess: (newRow) => {
        gridApi.applyTransaction({ add: [newRow] })
        if (onValidated) {
          onValidated('success', 'Row duplicated successfully.')
        }
      },
      onError: (error) => {
        console.error('Error duplicating row:', error)
        if (onValidated) {
          onValidated('error', `Error duplicating row: ${error.message}`)
        }
      }
    })
  }, [gridApi, fieldsToNullOnDuplicate, saveRow, onValidated])

  const updateRowHandler = useCallback((params) => {
    onValidated('pending', 'Updating row...')
    saveRow(params.data, {
      onSuccess: () => {
        params.data.modified = false
        params.api.refreshCells()
        if (onValidated) {
          onValidated('success', 'Row updated successfully.')
        }
      },
      onError: (error) => {
        console.error('Error updating row:', error)
        if (onValidated) {
          console.log(error)
          onValidated('error', `Error updating row: ${error.message}`)
        }
      }
    })
  }, [saveRow, onValidated])

  const onRowEditingStartedHandler = useCallback((params) => {
    params.api.refreshCells({
      columns: ['action'],
      rowNodes: [params.node],
      force: true,
    })
    if (onRowEditingStarted) {
      onRowEditingStarted(params)
    }
  }, [onRowEditingStarted])

  const onRowEditingStoppedHandler = useCallback((params) => {
    // Check if any data field has changed
    if (params.data.modified) {
      updateRowHandler(params)
    }
  
    params.api.redrawRows({ rowNodes: [params.node] })
  
    if (onRowEditingStopped) {
      onRowEditingStopped(params)
    }
  }, [onRowEditingStopped, updateRowHandler])
  
  function onCellValueChanged(params) {
    params.data.modified = true
  }

  const AgEditorStatusBar = (
    <Stack spacing={2} direction="row" m={2}>
      <BCButton variant="contained" color="primary" onClick={() => {console.log("save click")}}>
        Save changes
      </BCButton>
      <BCButton variant="outlined" color="primary" onClick={addRow}>
        Add new row
      </BCButton>
    </Stack>
  )

  return (
    <>
      <AgGridReact
        gridKey={gridKey}
        gridRef={gridRef}
        gridApi={gridApi}
        className={className}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        rowData={rowData}
        getRowNodeId={getRowNodeId}
        gridOptions={{ ...defaultGridOptions, ...gridOptions }}
        onGridReady={onGridReady}
        frameworkComponents={frameworkComponents}
        domLayout="autoHeight"
        onCellValueChanged={onCellValueChanged}
        onRowEditingStarted={onRowEditingStartedHandler}
        onRowEditingStopped={onRowEditingStoppedHandler}
        loadingOverlayComponent={loadingOverlayComponent}
        {...props}
        context={{ onDuplicate: duplicateRowHandler, onDelete: deleteRowHandler }}
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
          overflow: 'hidden',
        }}
      >
        {defaultStatusBar ? AgEditorStatusBar : props.statusBarComponent}
      </BCBox>
    </>
  )
}

BCDataGridEditor.propTypes = {
  defaultStatusBar: PropTypes.bool,
  statusBarComponent: PropTypes.node,
  onGridReady: PropTypes.func.isRequired,
  gridApi: PropTypes.object,
  columnApi: PropTypes.object,
  rowData: PropTypes.array,
  getRowNodeId: PropTypes.func,
  gridRef: PropTypes.object.isRequired,
  columnDefs: PropTypes.array.isRequired,
  defaultColDef: PropTypes.object.isRequired,
  highlightedRowId: PropTypes.string,
  fieldsToNullOnDuplicate: PropTypes.array,
  saveRow: PropTypes.object.isRequired,
  onValidated: PropTypes.func,
  className: PropTypes.oneOf([
    'ag-theme-alpine',
    'ag-theme-alpine-dark',
    'ag-theme-alpine-auto-dark',
    'ag-theme-material',
    'ag-theme-quartz',
    'ag-theme-quartz-dark',
    'ag-theme-quartz-auto-dark',
    'ag-theme-balham',
    'ag-theme-balham-dark',
    'ag-theme-balham-auto-dark',
  ]),
}

BCDataGridEditor.defaultProps = {
  highlightedRowId: null,
  gridRef: null,
  gridKey: `bcgrid-key-<unique-id>`,
  defaultStatusBar: true,
  statusBarComponent: null,
  gridApi: null,
  columnApi: null,
  loadingOverlayComponentParams: { loadingMessage: 'One moment please...' },
  className: 'ag-theme-quartz',
  getRowNodeId: uuid(),
  fieldsToNullOnDuplicate: [],
  onValidated: null,
}

export default BCDataGridEditor
