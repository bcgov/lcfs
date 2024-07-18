import { useMemo, useCallback, useEffect } from 'react'
import { AgGridReact } from '@ag-grid-community/react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'

import BCBox from '@/components/BCBox'
import DataGridLoading from '@/components/DataGridLoading'
import {
  AutocompleteEditor,
  AsyncValidationEditor,
  DateEditor,
  DateRangeCellEditor,
  ActionsRenderer,
  AsyncSuggestionEditor,
  ValidationRenderer,
  HeaderComponent,
  LargeTextareaEditor,
  TextCellEditor
} from '@/components/BCDataGrid/components'
import Papa from 'papaparse'
import '@ag-grid-community/styles/ag-grid.css'
import '@ag-grid-community/styles/ag-theme-quartz.css'
import { isEqual } from '@/utils/eventHandlers'
import AutocompleteCellEditor from './components/Editors/AutocompleteCellEditor'

const BCDataGridEditorV2 = (props) => {
  const {
    gridApi,
    gridKey,
    className,
    columnDefs,
    defaultColDef,
    gridRef,
    rowData,
    getRowNodeId,
    gridOptions,
    onGridReady,
  } = props
  // Register the Custom ag-grid components.
  const frameworkComponents = useMemo(
    () => ({
      asyncValidationEditor: AsyncValidationEditor,
      autocompleteEditor: AutocompleteEditor,
      autocompleteCellEditor: AutocompleteCellEditor,
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
  // Add ability to copy paste the rows directly on to the table from excel sheet
  const handleExcelPaste = useCallback(
    (params) => {
      const newData = []
      const clipboardData = params.clipboardData || window.clipboardData
      const pastedData = clipboardData.getData('text/plain')
      const headerRow = gridApi
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

  // Loading overlay component 
  const loadingOverlayComponent = useMemo(() => DataGridLoading, [])
  // action to perform when next cell is tabbed
  const tabToNextCell = useCallback((params) => params.nextCellPosition, [])
  // default grid options for the ag-grid.
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
  }), [frameworkComponents, tabToNextCell])
  
  function onCellValueChanged(params) {
    if (!isEqual(params.oldValue, params.newValue)) {
      params.data.modified = true
    }
  }

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
        loadingOverlayComponent={loadingOverlayComponent}
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
          overflow: 'hidden',
        }}
      >
        {props.statusBarComponent}
      </BCBox>
    </>
  )
}

BCDataGridEditorV2.propTypes = {
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
  saveRow: PropTypes.func.isRequired,
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

BCDataGridEditorV2.defaultProps = {
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
  onValidated: null,
}

export default BCDataGridEditorV2
