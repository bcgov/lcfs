import { CommonArrayRenderer } from '@/utils/cellRenderers'
import { suppressKeyboardEvent } from '@/utils/eventHandlers'
import { Typography } from '@mui/material'
import moment from 'moment'
import { v4 as uuid } from 'uuid'

// Copy the desired columns to new row
const duplicateRow = (props) => {
  const newRow = {
    ...props.data,
    id: uuid(),
    finalSupplyEquipmentId: null,
    serialNbr: undefined,
    latitude: undefined,
    longitude: undefined,
    modified: true
  }

  if (props.api) {
    props.api.applyTransaction({
      add: [newRow],
      addIndex: props.node?.rowIndex + 1
    })
    props.api.stopEditing()
  } else {
    console.error('API is undefined')
  }
}

const deleteRow = (props) => {
  const updatedRow = { ...props.data, deleted: true, modified: true }
  if (props.api) {
    props.api.applyTransaction({ update: [updatedRow] })
    props.api.applyTransaction({ remove: [props.node.data] })
    props.api.stopEditing()
  } else {
    console.error('API is undefined')
  }
}

export const finalSupplyEquipmentColDefs = (
  t,
  optionsData,
  compliancePeriod,
  api
) => [
  {
    colId: 'action',
    cellRenderer: 'actionsRenderer',
    cellRendererParams: {
      enableDuplicate: true,
      enableEdit: false,
      enableDelete: true,
      onDuplicate: (props) => duplicateRow({ ...props, api }),
      onDelete: (props) => deleteRow({ ...props, api })
    },
    pinned: 'left',
    maxWidth: 150,
    editable: false,
    suppressKeyboardEvent,
    filter: false,
    cellStyle: { backgroundColor: '#f2f2f2' }
  },
  {
    field: 'id',
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    hide: true
  },
  {
    field: 'complianceReportId',
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.complianceReportId'
    ),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    hide: true
  },
  {
    field: 'supplyFrom',
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.supplyFrom'
    ),
    headerComponent: 'headerComponent',
    width: 330,
    cellRenderer: (params) => (
      <Typography variant="body4">
        {params.value[0]
          ? `${params.value[0]} to ${params.value[1]}`
          : 'YYYY-MM-DD to YYYY-MM-DD'}
      </Typography>
    ),
    suppressKeyboardEvent,
    cellStyle: (params) => {
      if (params.data.modified && (!params.value || params.value === ''))
        return { borderColor: 'red' }
    },
    cellEditor: 'dateRangeCellEditor',
    cellEditorParams: {
      minDate: moment(`${compliancePeriod}-01-01`, 'YYYY-MM-DD').toDate(),
      maxDate: moment(`${compliancePeriod}-12-31`, 'YYYY-MM-DD').toDate()
    },
    valueGetter: (params) => {
      return [params.data.supplyFromDate, params.data.supplyToDate]
    },
    valueSetter: (params) => {
      params.data.supplyFromDate = params.newValue[0]
      params.data.supplyToDate = params.newValue[1]
      return true
    }
  },
  // {
  //   field: 'supplyFromDate',
  //   headerName: t(
  //     'finalSupplyEquipment:finalSupplyEquipmentColLabels.supplyFromDate'
  //   ),
  //   headerComponent: 'headerComponent',
  //   width: 220,
  //   cellRenderer: (params) => (
  //     <Typography variant="body4">
  //       {params.value ? params.value : 'YYYY-MM-DD'}
  //     </Typography>
  //   ),
  //   suppressKeyboardEvent,
  //   cellStyle: (params) => {
  //     if (params.data.modified && (!params.value || params.value === ''))
  //       return { borderColor: 'red' }
  //   },
  //   cellEditor: 'dateEditor',
  //   cellEditorParams: {
  //     minDate: moment(`${compliancePeriod}-01-01`, 'YYYY-MM-DD').toDate(),
  //     maxDate: moment(`${compliancePeriod}-12-31`, 'YYYY-MM-DD').toDate()
  //   }
  // },
  // {
  //   field: 'supplyToDate',
  //   headerComponent: 'headerComponent',
  //   headerName: t(
  //     'finalSupplyEquipment:finalSupplyEquipmentColLabels.supplyToDate'
  //   ),
  //   width: 220,
  //   cellRenderer: (params) => (
  //     <Typography variant="body4">
  //       {params.value ? params.value : 'YYYY-MM-DD'}
  //     </Typography>
  //   ),
  //   suppressKeyboardEvent,
  //   cellStyle: (params) => {
  //     if (params.data.modified && (!params.value || params.value === ''))
  //       return { borderColor: 'red' }
  //   },
  //   cellEditor: 'dateEditor',
  //   cellEditorParams: {
  //     minDate: moment(`${compliancePeriod}-01-01`, 'YYYY-MM-DD').toDate(),
  //     maxDate: moment(`${compliancePeriod}-12-31`, 'YYYY-MM-DD').toDate()
  //   },
  //   valueSetter: (params) => {
  //     if  (params.newValue > params.data.supplyFromDate) {
  //       params.data[params.colDef.field] = params.newValue
  //       return true
  //     }
  //   }
  // },
  {
    field: 'serialNbr',
    headerComponent: 'headerComponent',
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.serialNbr'
    ),
    minWidth: 220,
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    cellStyle: (params) => {
      if (params.data.modified && (!params.value || params.value === ''))
        return { borderColor: 'red' }
    }
  },
  {
    field: 'manufacturer',
    headerComponent: 'headerComponent',
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.manufacturer'
    ),
    minWidth: 320,
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    cellStyle: (params) => {
      if (params.data.modified && (!params.value || params.value === ''))
        return { borderColor: 'red' }
    }
  },
  {
    field: 'levelOfEquipment',
    headerComponent: 'headerComponent',
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.levelOfEquipment'
    ),
    cellEditor: 'agSelectCellEditor',
    cellDataType: 'text',
    minWidth: 430,
    cellEditorParams: {
      values: optionsData.levelsOfEquipment.map((obj) => obj.name)
    },
    cellStyle: (params) => {
      if (params.data.modified && (!params.value || params.value === ''))
        return { borderColor: 'red' }
    },
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>)
  },
  {
    field: 'fuelMeasurementType',
    headerComponent: 'headerComponent',
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.fuelMeasurementType'
    ),
    cellEditor: 'agSelectCellEditor',
    cellDataType: 'text',
    minWidth: 315,
    cellEditorParams: {
      values: optionsData.fuelMeasurementTypes.map((obj) => obj.type) || []
    },
    cellStyle: (params) => {
      if (params.data.modified && (!params.value || params.value === ''))
        return { borderColor: 'red' }
    },
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>)
  },
  {
    field: 'intendedUses',
    headerComponent: 'headerComponent',
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.intendedUse'
    ),
    cellEditor: 'autocompleteEditor',
    cellEditorParams: {
      options: optionsData?.intendedUseTypes.map((obj) => obj.type) || [],
      multiple: true,
      disableCloseOnSelect: true,
      openOnFocus: true
    },
    cellStyle: (params) => {
      if (params.data.modified && (!params.value || params.value === ''))
        return { borderColor: 'red' }
    },
    cellRenderer: (params) =>
      (params.value && params.value !== '' && (
        <CommonArrayRenderer disableLink {...params} />
      )) ||
      (!params.value && <Typography variant="body4">Select</Typography>),
    suppressKeyboardEvent,
    minWidth: 560
  },
  {
    field: 'streetAddress',
    headerComponent: 'headerComponent',
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.streetAddress'
    ),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    cellStyle: (params) => {
      if (params.data.modified && (!params.value || params.value === ''))
        return { borderColor: 'red' }
    },
    minWidth: 260
  },
  {
    field: 'city',
    headerComponent: 'headerComponent',
    headerName: t('finalSupplyEquipment:finalSupplyEquipmentColLabels.city'),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    cellStyle: (params) => {
      if (params.data.modified && (!params.value || params.value === ''))
        return { borderColor: 'red' }
    },
    minWidth: 260
  },
  {
    field: 'postalCode',
    headerComponent: 'headerComponent',
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.postalCode'
    ),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    cellStyle: (params) => {
      if (params.data.modified && (!params.value || params.value === ''))
        return { borderColor: 'red' }
    },
    minWidth: 260
  },
  {
    field: 'latitude',
    headerComponent: 'headerComponent',
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.latitude'
    ),
    cellEditor: 'agNumberCellEditor',
    cellEditorParams: {
      precision: 4,
      showStepperButtons: false
    },
    type: 'numericColumn',
    cellStyle: (params) => {
      if (params.data.modified && (!params.value || params.value === ''))
        return { borderColor: 'red' }
    },
    minWidth: 260
  },
  {
    field: 'longitude',
    headerComponent: 'headerComponent',
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.longitude'
    ),
    cellEditor: 'agNumberCellEditor',
    cellEditorParams: {
      precision: 4,
      showStepperButtons: false
    },
    type: 'numericColumn',
    cellStyle: (params) => {
      if (params.data.modified && (!params.value || params.value === ''))
        return { borderColor: 'red' }
    },
    minWidth: 260
  },
  {
    field: 'notes',
    headerName: t('finalSupplyEquipment:finalSupplyEquipmentColLabels.notes'),
    cellEditor: 'agTextCellEditor',
    // suppressKeyboardEvent,
    // cellEditorPopup: true,
    // cellEditorParams: { rows: 5 },
    cellStyle: (params) => {
      if (params.data.modified && (!params.value || params.value === ''))
        return { borderColor: 'red' }
    },
    minWidth: 500
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
