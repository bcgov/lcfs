import { KEY_ENTER, KEY_TAB } from '@/constants/common'
import { v4 as uuid } from 'uuid'

// copy the desired columns to new row
const duplicateRow = (props) => {
  const newRow = {
    ...props.data,
    id: uuid(),
    modified: true,
    fuelCode: 1000 + (props.node.rowIndex + 1) / 10
  }
  props.api.applyTransaction({
    add: [newRow],
    addIndex: props.node.rowIndex + 1
  })
}

const onPrefixUpdate = (val, params) => {
  if (val === 'BCLCF') {
    params.node.setData({
      ...params.data,
      fuelCode: 1000 + params.node.rowIndex / 10
    })
  }
}

export const fuelCodeColDefs = (t) => [
  {
    colId: 'action',
    cellRenderer: 'actionsRenderer',
    cellRendererParams: {
      enableDuplicate: true,
      enableEdit: false,
      enableDelete: true,
      onDuplicate: duplicateRow
    },
    // checkboxSelection: true,
    // headerCheckboxSelection: true,
    // field: 'checkobxBtn',
    pinned: 'left',
    maxWidth: 100,
    editable: false,
    suppressKeyboardEvent: (params) =>
      params.event.key === KEY_ENTER || params.event.key === KEY_TAB,
    filter: false
  },
  {
    field: 'id',
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    hide: true
  },
  {
    field: 'prefix',
    headerName: t('fuelCode:fuelCodeColLabels.prefix'),
    cellEditor: 'autocompleteEditor',
    cellEditorParams: {
      onDynamicUpdate: onPrefixUpdate, // to alter any other column based on the value selected.
      // (ensure valueGetter is not added to the column which you want to update dynamically)
      options: ['BCLCF'],
      multiple: false, // ability to select multiple values from dropdown
      disableCloseOnSelect: false, // if multiple is true, this will prevent closing dropdown on selecting an option
      freeSolo: false, // this will allow user to type in the input box or choose from the dropdown
      openOnFocus: true // this will open the dropdown on input focus
    },
    suppressKeyboardEvent: (params) => {
      // return true (to suppress) if editing and user hit Enter key
      return params.editing && params.event.key === KEY_ENTER
    },
    cellDataType: 'text',
    minWidth: 135
  },
  {
    field: 'fuelCode',
    headerName: t('fuelCode:fuelCodeColLabels.fuelCode'),
    cellDataType: 'number',
    editable: false
  },
  {
    field: 'company',
    headerName: t('fuelCode:fuelCodeColLabels.company'),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    minWidth: 300
  },
  {
    field: 'carbonIntensity',
    headerName: t('fuelCode:fuelCodeColLabels.carbonIntensity'),
    cellEditor: 'agNumberCellEditor',
    cellEditorParams: {
      precision: 2,
      showStepperButtons: false
    },
    type: 'numericColumn'
  },
  {
    field: 'edrms',
    headerName: t('fuelCode:fuelCodeColLabels.edrms'),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text'
  },
  {
    field: 'lastUpdated',
    headerName: t('fuelCode:fuelCodeColLabels.lastUpdated'),
    minWidth: 180,
    editable: false, // TODO: change as per #516
    cellDataType: 'dateString',
    valueGetter: (params) => {
      return new Date().toLocaleDateString()
    }
  },
  {
    field: 'applicationDate',
    headerName: t('fuelCode:fuelCodeColLabels.applicationDate'),
    minWidth: 180,
    suppressKeyboardEvent: (params) => params.editing,
    cellEditor: 'dateEditor'
  },
  {
    field: 'approvalDate',
    headerName: t('fuelCode:fuelCodeColLabels.approvalDate'),
    minWidth: 180,
    suppressKeyboardEvent: (params) => params.editing,
    cellEditor: 'dateEditor'
  },
  {
    field: 'effectiveDate',
    headerName: t('fuelCode:fuelCodeColLabels.effectiveDate'),
    minWidth: 180,
    suppressKeyboardEvent: (params) => params.editing,
    cellEditor: 'dateEditor'
  },
  {
    field: 'expiryDate',
    headerName: t('fuelCode:fuelCodeColLabels.expiryDate'),
    minWidth: 180,
    suppressKeyboardEvent: (params) => params.editing,
    cellEditor: 'dateEditor'
  },
  {
    field: 'fuel',
    headerName: t('fuelCode:fuelCodeColLabels.fuel'),
    cellEditor: 'autocompleteEditor',
    cellEditorParams: {
      options: [
        'Biodiesel',
        'CNG',
        'Electricity',
        'Ethanol',
        'HDRD',
        'Hydrogen',
        'LNG',
        'Other - gasoline category',
        'Other diesel fuel',
        'Other - diesel category',
        'Alternative jet fuel',
        'Other - jet fuel category',
        'Propane',
        'Renewable gasoline',
        'Renewable naphtha',
        'Fossil-derived diesel',
        'Fossil-derived gasoline',
        'Fossil-derived jet-fuel'
      ],
      multiple: false, // ability to select multiple values from dropdown
      disableCloseOnSelect: false, // if multiple is true, this will prevent closing dropdown on selecting an option
      freeSolo: false, // this will allow user to type in the input box or choose from the dropdown
      openOnFocus: true // this will open the dropdown on input focus
    }, // TODO: Implement dropdown by making api call
    suppressKeyboardEvent: (params) => {
      // return true (to suppress) if editing and user hit Enter key
      return params.editing && params.event.key === KEY_ENTER
    },
    minWidth: 300
  },
  {
    field: 'feedstock',
    headerName: t('fuelCode:fuelCodeColLabels.feedstock'),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    minWidth: 300
  },
  {
    field: 'feedstockLocation',
    headerName: t('fuelCode:fuelCodeColLabels.feedstockLocation'),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    minWidth: 300
  },
  {
    field: 'misc',
    headerName: t('fuelCode:fuelCodeColLabels.misc'),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    minWidth: 495
  },
  {
    field: 'fuelProductionFacilityLocation',
    headerName: t('fuelCode:fuelCodeColLabels.fuelProductionFacilityLocation'),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    minWidth: 325 // TODO: handle in #486
  },
  {
    field: 'facilityNameplateCapacity',
    headerName: t('fuelCode:fuelCodeColLabels.facilityNameplateCapacity'),
    cellEditor: 'agNumberCellEditor',
    type: 'numericColumn',
    cellEditorParams: {
      precision: 0,
      min: 0,
      showStepperButtons: false
    },
    minWidth: 290
  },
  {
    field: 'feedstockTransportMode',
    headerName: t('fuelCode:fuelCodeColLabels.feedstockTransportMode'),
    cellEditor: 'autocompleteEditor',
    cellEditorParams: {
      options: ['Truck', 'Rail', 'Marine', 'Adjacent', 'Pipeline'], // TODO: need to pull from backend
      multiple: true,
      openOnFocus: true,
      disableCloseOnSelect: true
    },
    suppressKeyboardEvent: (params) => params.editing,
    minWidth: 300
  },
  {
    field: 'finishedFuelTransportMode',
    headerName: t('fuelCode:fuelCodeColLabels.finishedFuelTransportMode'),
    cellEditor: 'autocompleteEditor',
    cellEditorParams: {
      options: ['Truck', 'Rail', 'Marine', 'Adjacent', 'Pipeline'], // TODO: need to pull from backend
      multiple: true,
      openOnFocus: true,
      disableCloseOnSelect: true
    },
    suppressKeyboardEvent: (params) => params.editing,
    minWidth: 300
  },
  {
    field: 'formerCompany',
    headerName: t('fuelCode:fuelCodeColLabels.formerCompany'),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    minWidth: 300
  },
  {
    field: 'notes',
    headerName: t('fuelCode:fuelCodeColLabels.notes'),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    minWidth: 400
  }
]

export const defaultColDef = {
  editable: true,
  resizable: true,
  filter: true,
  floatingFilter: false,
  sortable: false,
  singleClickEdit: true
}
