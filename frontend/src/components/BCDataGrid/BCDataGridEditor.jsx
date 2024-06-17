import React, { useMemo, useCallback } from 'react'
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
  AsyncSuggestionEditor
} from '@/components/BCDataGrid/components'
import { useNotionalTransferActions } from '@/hooks/useNotionalTransfer'

import '@ag-grid-community/styles/ag-grid.css'
import '@ag-grid-community/styles/ag-theme-quartz.css'

const BCDataGridEditor = ({
  saveData,
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
  ...props
}) => {
  const { saveRow } = useNotionalTransferActions()

  const frameworkComponents = useMemo(() => ({
    asyncValidationEditor: AsyncValidationEditor,
    autocompleteEditor: AutocompleteEditor,
    dateEditor: DateEditor,
    actionsRenderer: ActionsRenderer,
    asyncSuggestionEditor: AsyncSuggestionEditor,
  }), [])

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

  const duplicateRow = useCallback((rowData) => {
    const newData = { ...rowData, id: uuid() }
    fieldsToNullOnDuplicate.forEach(field => {
      newData[field] = null
    })
    saveRow.mutate(newData, {
      onSuccess: (newRow) => {
        gridApi.applyTransaction({ add: [newRow] })
      },
      onError: (error) => {
        console.error('Error duplicating row:', error)
      }
    })
  }, [gridApi, fieldsToNullOnDuplicate, saveRow])

  const deleteRow = useCallback((rowData) => {
    const updatedData = { ...rowData, deleted: true }
    saveRow.mutate(updatedData, {
      onSuccess: () => {
        gridApi.applyTransaction({ remove: [rowData] })
      },
      onError: (error) => {
        console.error('Error deleting row:', error)
      }
    })
  }, [gridApi, saveRow])

  const onRowEditingStoppedHandler = useCallback((params) => {
    params.api.redrawRows({ rowNodes: [params.node] })
    saveRow.mutate(params.data, {
      onSuccess: () => {
        params.api.refreshCells()
      },
      onError: (error) => {
        console.error('Error saving row:', error)
      },
    })
    if (onRowEditingStopped) {
      onRowEditingStopped(params)
    }
  }, [onRowEditingStopped, saveRow])

  function onCellValueChanged(params) {
    params.data.modified = true
  }

  const AgEditorStatusBar = (
    <Stack spacing={2} direction="row" m={2}>
      <BCButton variant="contained" color="primary" onClick={saveData}>
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
        onRowEditingStopped={onRowEditingStoppedHandler}
        loadingOverlayComponent={loadingOverlayComponent}
        {...props}
        context={{ onDuplicate: duplicateRow, onDelete: deleteRow }}
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
        {defaultStatusBar ? AgEditorStatusBar : props.statusBarcomponent}
      </BCBox>
    </>
  )
}

BCDataGridEditor.propTypes = {
  saveData: PropTypes.func,
  defaultStatusBar: PropTypes.bool,
  statusBarcomponent: PropTypes.node,
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
  statusBarcomponent: null,
  gridApi: null,
  columnApi: null,
  loadingOverlayComponentParams: { loadingMessage: 'One moment please...' },
  className: 'ag-theme-quartz',
  getRowNodeId: uuid(),
  fieldsToNullOnDuplicate: [],
}

export default BCDataGridEditor
