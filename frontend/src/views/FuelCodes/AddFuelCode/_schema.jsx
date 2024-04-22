import { v4 as uuid } from 'uuid'

const duplicateRow = (props) => {
  const newRow = { ...props.data, id: uuid(), modified: true }
  props.api.applyTransaction({
    add: [newRow],
    addIndex: props.rowIndex + 1
  })
}

export const columnDefs = [
  {
    headerName: '',
    cellRenderer: 'actionsRenderer',
    cellRendererParams: {
      onDuplicate: duplicateRow
    },
    checkboxSelection: true,
    headerCheckboxSelection: true,
    pinned: 'left',
    field: 'checkobxBtn',
    maxWidth: 100,
    editable: false,
  },
  {
    field: 'id',
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text'
  },
  {
    field: 'prefix',
    headerName: 'Prefix (agSelectCellEditor)',
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: { values: ['BCLCF', 'GEN'] }
  },
  {
    field: 'feedstockTransportMode',
    headerName: 'Feedstock Transport Mode (autocompleteEditor)',
    cellEditor: 'autocompleteEditor',
    cellEditorParams: {
      options: ['Ethanol', 'Biodiesel', 'CNG', 'Electricity'],
      multiple: true,
      disableCloseOnSelect: true
    },
    suppressKeyboardEvent: (params) => {
      // return true (to suppress) if editing and user hit Enter key
      return params.editing && params.event.key === 'Enter'
    }
  },
  {
    field: 'fuel',
    headerName: 'Fuel (asyncValidationEditor)',
    cellEditor: 'asyncValidationEditor',
    cellEditorParams: {
      condition: (value) =>
        ['Ethanol', 'Biodiesel', 'CNG', 'Electricity'].includes(value),
      debounceLimit: 250
    }
  },
  {
    field: 'company',
    headerName: 'Company (async suggestion)',
    cellEditor: 'aysncSuggestionEditor',
    suppressKeyboardEvent: (params) => {
      // return true (to suppress) if editing and user hit Enter key
      return params.editing && params.event.key === 'Enter'
    },
    minWidth: 300
  },
  {
    field: 'applicationDate',
    headerName: 'Application Date (DateEditor)',
    cellEditor: 'dateEditor'
  },
  {
    field: 'approvalDate',
    headerName: 'Approval Date (agDateEditor)',
    cellEditor: 'agDateStringCellEditor'
  },
  {
    field: 'facilityNameplaceCapacity',
    headerName: 'Facility Nameplace Capacity(agNumberEditor)',
    cellEditor: 'agNumberCellEditor',
    cellEditorParams: {
      precision: 2,
      step: 0.25,
      showStepperButtons: true
    }
  },
  {
    field: 'feedstockLocation',
    headerName: 'Feedstock Location (readOnly)',
    editable: false
  },
  // {
  //   field: 'notes',
  //   headerName: 'Notes (agLargeTextEditor)',
  //   cellEditor: 'agLargeTextCellEditor',
  //   cellEditorPopup: true,
  //   cellEditorParams: {
  //     rows: 5,
  //     cols: 30
  //   },
  //   maxWidth: 300
  // }
]

export const defaultColDef = {
  editable: true,
  resizable: true,
  filter: true,
  floatingFilter: false,
  sortable: false,
  // flex: 1,
  singleClickEdit: true,
  suppressKeyboardEvent: (params) => {
    // return true (to suppress) if editing and user hit Enter key
    return true
  }
  // suppressKeyboardEvent: (params) => params.editing
}
