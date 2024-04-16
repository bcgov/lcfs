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
  AysncSuggestionEditor
} from '@/components/BCDataGrid/components'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'

/**
 * BCDataGridEditor component is a customizable data grid editor using ag-grid.
 * It provides features like adding new rows, deleting selected rows, and saving changes.
 *
 * @param {function} saveData - Function to save changes made to the grid.
 * @param {function} onGridReady - Callback function invoked when the grid is initialized and ready.
 * @param {object} gridApi - Reference to the ag-grid API.
 * @param {object} columnApi - Reference to the ag-grid column API.
 * @param {array} rowData - Data to be displayed in the grid.
 * @param {string} gridKey - Unique key identifier for the grid.
 * @param {function} getRowNodeId - Function to get the unique identifier for each row.
 * @param {object} gridRef - Reference to the ag-grid instance.
 * @param {array} columnDefs - Definitions for the columns in the grid.
 * @param {object} defaultColDef - Default column definition for the grid.
 * @param {string} highlightedRowId - ID of the row to be highlighted.
 */
function BCDataGridEditor({
  saveData,
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
  ...others
}) {
  // Define framework components for ag-grid
  const frameworkComponents = {
    simpleEditor: SimpleEditor,
    asyncValidationEditor: AsyncValidationEditor,
    autocompleteEditor: AutocompleteEditor,
    dateEditor: DateEditor,
    actionsRenderer: ActionsRenderer,
    aysncSuggestionEditor: AysncSuggestionEditor
  }

  // Default ag-grid options
  const defaultGridOptions = useMemo(
    () => ({
      undoRedoCellEditing: true,
      undoRedoCellEditingLimit: 5,
      reactiveCustomComponents: true,
      overlayNoRowsTemplate: 'No rows found',
      autoSizeStrategy: { type: 'fitCellContents' },
      suppressDragLeaveHidesColumns: true,
      suppressMovableColumns: true,
      suppressColumnMoveAnimation: false,
      rowSelection: 'single',
      rowHeight: 45,
      headerHeight: 40,
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
    }),
    [highlightedRowId]
  )

  // Function to add a new row
  const addRow = () => {
    const id = uuid()
    const emptyRow = { id }
    gridApi.applyTransaction({ add: [emptyRow] })
  }

  // Function to delete selected row
  const deleteRow = () => {
    const selectedRows = gridApi.getSelectedRows()
    gridApi.applyTransaction({ remove: selectedRows })
  }

  // Function called when cell value changes
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
        className={className}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        rowData={rowData}
        getRowNodeId={getRowNodeId}
        gridOptions={{ ...defaultGridOptions }}
        onGridReady={onGridReady}
        frameworkComponents={frameworkComponents}
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

BCDataGridEditor.defaultProps = {
  gridRef: null,
  gridKey: `bcgrid-key-<unique-id>`,
  gridOptions: {},
  loadingOverlayComponentParams: { loadingMessage: 'One moment please...' },
  defaultColDef: {},
  className: 'ag-theme-alpine',
  saveData: () => console.log('No save'),
  rowData: [],
  getRowNodeId: uuid(),
  columnDefs: []
}

BCDataGridEditor.propTypes = {
  saveData: PropTypes.func.isRequired,
  onGridReady: PropTypes.func.isRequired,
  gridApi: PropTypes.object.isRequired,
  columnApi: PropTypes.object.isRequired,
  rowData: PropTypes.array.isRequired,
  gridKey: PropTypes.string.isRequired,
  getRowNodeId: PropTypes.func.isRequired,
  gridRef: PropTypes.object.isRequired,
  columnDefs: PropTypes.array.isRequired,
  defaultColDef: PropTypes.object.isRequired,
  highlightedRowId: PropTypes.string,
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
    'ag-theme-balham-auto-dark'
  ])
}
BCDataGridEditor.defaultProps = {
  highlightedRowId: null
}

export default BCDataGridEditor
