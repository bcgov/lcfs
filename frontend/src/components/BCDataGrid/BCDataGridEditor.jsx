import { useMemo } from 'react'
import { AgGridReact } from '@ag-grid-community/react'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import { Stack } from '@mui/material'
import {
  SimpleEditor,
  AutocompleteEditor,
  AsyncValidationEditor,
  DateEditor,
  ActionsRenderer,
  AysncSuggestionEditor,
  AddRowStatusBar
} from '@/components/BCDataGrid/components'
import { v4 as uuid } from 'uuid'

function BCDataGridEditor({
  saveData,
  onGridReady,
  gridOptions,
  rowData,
  gridApi,
  columnApi,
  gridKey,
  getRowNodeId,
  defaultSortModel,
  defaultFilterModel,
  apiEndpoint,
  apiData,
  gridRef,
  className,
  columnDefs,
  defaultColDef,
  getRowId,
  handleGridKey,
  handleRowClicked,
  paginationPageSize,
  paginationPageSizeSelector,
  highlightedRowId,
  ...others
}) {
  const frameworkComponents = {
    simpleEditor: SimpleEditor,
    asyncValidationEditor: AsyncValidationEditor,
    autocompleteEditor: AutocompleteEditor,
    dateEditor: DateEditor,
    actionsRenderer: ActionsRenderer,
    addRowStatusBar: AddRowStatusBar,
    aysncSuggestionEditor: AysncSuggestionEditor
  }

  // Memorized default ag-grid options
  // For more details please refer https://ag-grid.com/javascript-data-grid/grid-options/
  const defaultGridOptions = useMemo(() => ({
    // enables undo / redo
    undoRedoCellEditing: true,
    // restricts the number of undo / redo steps to 5
    undoRedoCellEditingLimit: 5,
    reactiveCustomComponents: true,
    overlayNoRowsTemplate: 'No rows found',
    autoSizeStrategy: { type: 'fitCellContents' },
    suppressDragLeaveHidesColumns: true,
    suppressMovableColumns: true,
    suppressColumnMoveAnimation: false,
    rowSelection: 'single',
    animateRows: true,
    suppressPaginationPanel: true,
    suppressScrollOnNewData: true,
    suppressCsvExport: false,
    components: frameworkComponents,
    getRowStyle: highlightedRowId
      ? (params) => {
          if (params.node.id === highlightedRowId) {
            return { backgroundColor: '#fade81' }
          }
        }
      : undefined
  }))

  const addRow = () => {
    const id = uuid()
    const emptyRow = { id }
    gridApi.applyTransaction({ add: [emptyRow] })
  }

  const deleteRow = () => {
    const selectedRows = gridApi.getSelectedRows()
    // make 
    gridApi.applyTransaction({ remove: selectedRows })
  }

  function onCellValueChanged(event) {
    console.log('onCellValueChanged', event)
    event.data.modified = true // Mark the entire row as modified
  }

  return (
    <BCBox
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
      className="bc-grid-container"
    >
      <AgGridReact
        gridRef={gridRef}
        gridApi={gridApi}
        className="ag-theme-alpine"
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        rowData={rowData}
        getRowNodeId={getRowNodeId}
        gridOptions={{ ...defaultGridOptions, ...gridOptions }}
        onGridReady={onGridReady}
        frameworkComponents={frameworkComponents}
        // editType="fullRow"
        // suppressClickEdit
        domLayout="autoHeight"
        onCellValueChanged={onCellValueChanged}
        {...others}
      />
      <BCBox
        display="flex"
        justifyContent="flex-start"
        variant="outlined"
        sx={{ maxHeight: '4.5rem', position: 'relative' }}
      >
        <Stack spacing={2} direction="row" m={2}>
          <BCButton variant="contained" color="primary" onClick={saveData}>
            Save changes
          </BCButton>
          <BCButton variant="outlined" color="primary" onClick={addRow}>
            Add new row
          </BCButton>
          <BCButton variant="outlined" color="error" onClick={deleteRow}>
            Delete selected row
          </BCButton>
        </Stack>
      </BCBox>
    </BCBox>
  )
}

export default BCDataGridEditor
