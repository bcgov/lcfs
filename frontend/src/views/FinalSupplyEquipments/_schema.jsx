import { suppressKeyboardEvent } from '@/utils/grid/eventHandlers'
import { Typography } from '@mui/material'
import {
  AutocompleteEditor,
  RequiredHeader,
  DateRangeCellEditor,
  TextCellEditor,
  AsyncSuggestionEditor
} from '@/components/BCDataGrid/components'
import i18n from '@/i18n'
import { actions, validation } from '@/components/BCDataGrid/columns'
import moment from 'moment'
import { CommonArrayRenderer } from '@/utils/grid/cellRenderers'
import { StandardCellErrors } from '@/utils/grid/errorRenderers'
import { apiRoutes } from '@/constants/routes'

export const finalSupplyEquipmentColDefs = (
  optionsData,
  compliancePeriod,
  errors
) => [
  validation,
  actions({
    enableDuplicate: true,
    enableDelete: true
  }),
  {
    field: 'id',
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    hide: true
  },
  {
    field: 'complianceReportId',
    headerName: i18n.t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.complianceReportId'
    ),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    hide: true
  },
  {
    field: 'supplyFrom',
    headerName: i18n.t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.supplyFrom'
    ),
    headerComponent: RequiredHeader,
    minWidth: 330,
    cellRenderer: (params) => (
      <Typography variant="body4">
        {params.value[0]
          ? `${params.value[0]} to ${params.value[1]}`
          : 'YYYY-MM-DD to YYYY-MM-DD'}
      </Typography>
    ),
    suppressKeyboardEvent,
    cellStyle: (params) => StandardCellErrors(params, errors),
    cellEditor: DateRangeCellEditor,
    cellEditorParams: {
      minDate: moment(`${compliancePeriod}-01-01`, 'YYYY-MM-DD').toDate(),
      maxDate: moment(`${compliancePeriod}-12-31`, 'YYYY-MM-DD').toDate()
    },
    valueGetter: (params) => {
      return [
        params.data.supplyFromDate || `${compliancePeriod}-01-01`,
        params.data.supplyToDate || `${compliancePeriod}-12-31`
      ]
    },
    valueSetter: (params) => {
      params.data.supplyFromDate = params.newValue[0]
      params.data.supplyToDate = params.newValue[1]
      return true
    }
  },
  {
    field: 'serialNbr',
    headerComponent: RequiredHeader,
    headerName: i18n.t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.serialNbr'
    ),
    minWidth: 220,
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    cellStyle: (params) => StandardCellErrors(params, errors)
  },
  {
    field: 'manufacturer',
    headerComponent: RequiredHeader,
    headerName: i18n.t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.manufacturer'
    ),
    minWidth: 320,
    cellEditor: AsyncSuggestionEditor,
    cellEditorParams: (params) => ({
      queryKey: 'fuel-code-search',
      queryFn: async ({ client }) => {
        const path = `${apiRoutes.searchFinalSupplyEquipments}manufacturer${params.data.manufacturer}`
        const response = await client.get(path)
        return response.data
      },
      optionLabel: 'fuelCodes',
      title: 'fuelCode'
    }),
    suppressKeyboardEvent,
    cellDataType: 'text',
    cellStyle: (params) => StandardCellErrors(params, errors)
  },
  {
    field: 'levelOfEquipment',
    headerComponent: RequiredHeader,
    headerName: i18n.t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.levelOfEquipment'
    ),
    cellEditor: AutocompleteEditor,
    suppressKeyboardEvent,
    minWidth: 430,
    cellEditorParams: {
      options: optionsData?.levelsOfEquipment.map((obj) => obj.name),
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    },
    cellStyle: (params) => StandardCellErrors(params, errors),
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>)
  },
  {
    field: 'fuelMeasurementType',
    headerComponent: RequiredHeader,
    headerName: i18n.t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.fuelMeasurementType'
    ),
    cellEditor: AutocompleteEditor,
    suppressKeyboardEvent,
    minWidth: 315,
    cellEditorParams: {
      options: optionsData?.fuelMeasurementTypes.map((obj) => obj.type) || [],
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    },
    cellStyle: (params) => StandardCellErrors(params, errors),
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>)
  },
  {
    field: 'intendedUses',
    headerComponent: RequiredHeader,
    headerName: i18n.t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.intendedUses'
    ),
    cellEditor: AutocompleteEditor,
    cellEditorParams: {
      options: optionsData?.intendedUseTypes.map((obj) => obj.type) || [],
      multiple: true,
      disableCloseOnSelect: true,
      openOnFocus: true
    },
    cellStyle: (params) => StandardCellErrors(params, errors),
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
    headerComponent: RequiredHeader,
    headerName: i18n.t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.streetAddress'
    ),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    cellStyle: (params) => StandardCellErrors(params, errors),
    minWidth: 260
  },
  {
    field: 'city',
    headerComponent: RequiredHeader,
    headerName: i18n.t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.city'
    ),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    cellStyle: (params) => StandardCellErrors(params, errors),
    minWidth: 260
  },
  {
    field: 'postalCode',
    headerComponent: RequiredHeader,
    headerName: i18n.t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.postalCode'
    ),
    valueSetter: (params) => {
      const newValue = params.newValue.toUpperCase()
      params.data[params.colDef.field] = newValue
      return true
    },
    cellEditor: TextCellEditor,
    cellEditorParams: {
      mask: 'A1A 1A1',
      formatChars: {
        A: '[A-Za-z]',
        1: '[0-9]'
      }
    },
    suppressKeyboardEvent,
    cellDataType: 'text',
    cellStyle: (params) => StandardCellErrors(params, errors),
    minWidth: 150
  },
  {
    field: 'latitude',
    headerComponent: RequiredHeader,
    headerName: i18n.t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.latitude'
    ),
    cellEditor: 'agNumberCellEditor',
    cellEditorParams: {
      precision: 4,
      showStepperButtons: false
    },
    cellDataType: 'number',
    cellStyle: (params) => StandardCellErrors(params, errors),
    minWidth: 150
  },
  {
    field: 'longitude',
    headerComponent: RequiredHeader,
    headerName: i18n.t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.longitude'
    ),
    cellEditor: 'agNumberCellEditor',
    cellEditorParams: {
      precision: 4,
      showStepperButtons: false
    },
    cellDataType: 'number',
    cellStyle: (params) => StandardCellErrors(params, errors),
    minWidth: 150
  },
  {
    field: 'notes',
    headerName: i18n.t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.notes'
    ),
    cellEditor: 'agTextCellEditor',
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
