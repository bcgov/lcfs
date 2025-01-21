import { suppressKeyboardEvent } from '@/utils/grid/eventHandlers'
import BCTypography from '@/components/BCTypography'
import {
  AutocompleteCellEditor,
  RequiredHeader,
  DateRangeCellEditor,
  TextCellEditor,
  AsyncSuggestionEditor,
  NumberEditor
} from '@/components/BCDataGrid/components'
import i18n from '@/i18n'
import { actions, validation } from '@/components/BCDataGrid/columns'
import dayjs from 'dayjs'
import { CommonArrayRenderer } from '@/utils/grid/cellRenderers'
import {
  StandardCellWarningAndErrors,
  StandardCellErrors
} from '@/utils/grid/errorRenderers'
import { apiRoutes } from '@/constants/routes'
import { numberFormatter } from '@/utils/formatters.js'

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
    field: 'organizationName',
    headerComponent: RequiredHeader,
    headerName: i18n.t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.organizationName'
    ),
    cellEditor: AutocompleteCellEditor,
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <BCTypography variant="body4">Select</BCTypography>),
    cellEditorParams: {
      options: optionsData?.organizationNames?.sort() || [],
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: true,
      openOnFocus: true
    },
    cellStyle: (params) => StandardCellWarningAndErrors(params, errors),
    suppressKeyboardEvent,
    minWidth: 260,
    editable: true,
    valueGetter: (params) => {
      return params.data?.organizationName || ''
    },
    valueSetter: (params) => {
      if (params.newValue) {
        const isValidOrganizationName = optionsData?.organizationNames.includes(
          params.newValue
        )

        params.data.organizationName = isValidOrganizationName
          ? params.newValue
          : params.newValue
        return true
      }
      return false
    },
    tooltipValueGetter: (params) => 'Select the organization name from the list'
  },
  {
    field: 'supplyFrom',
    headerName: i18n.t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.supplyFrom'
    ),
    headerComponent: RequiredHeader,
    minWidth: 330,
    cellRenderer: (params) => (
      <BCTypography variant="body4">
        {params.value[0]
          ? `${params.value[0]} to ${params.value[1]}`
          : 'YYYY-MM-DD to YYYY-MM-DD'}
      </BCTypography>
    ),
    suppressKeyboardEvent,
    cellStyle: (params) => StandardCellErrors(params, errors),
    cellEditor: DateRangeCellEditor,
    cellEditorParams: {
      minDate: dayjs(`${compliancePeriod}-01-01`, 'YYYY-MM-DD').toDate(),
      maxDate: dayjs(`${compliancePeriod}-12-31`, 'YYYY-MM-DD').toDate()
    },
    cellEditorPopup: true,
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
    field: 'kwhUsage',
    headerName: i18n.t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.kwhUsage'
    ),
    minWidth: 220,
    valueFormatter: numberFormatter,
    cellEditor: NumberEditor,
    type: 'numericColumn',
    cellEditorParams: {
      precision: 0,
      min: 0,
      showStepperButtons: false
    },
    cellStyle: (params) => StandardCellErrors(params, errors)
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
      queryFn: async ({ client, queryKey }) => {
        try {
          const [, searchTerm] = queryKey
          const path = `${
            apiRoutes.searchFinalSupplyEquipments
          }manufacturer=${encodeURIComponent(searchTerm)}`
          const response = await client.get(path)
          return response.data
        } catch (error) {
          console.error('Error fetching manufacturer data:', error)
          return []
        }
      },
      optionLabel: 'manufacturer',
      title: 'fuelCode'
    }),
    suppressKeyboardEvent,
    cellDataType: 'text',
    cellStyle: (params) => StandardCellErrors(params, errors)
  },
  {
    field: 'model',
    headerName: i18n.t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.model'
    ),
    minWidth: 220,
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    cellStyle: (params) => StandardCellErrors(params, errors)
  },
  {
    field: 'levelOfEquipment',
    headerComponent: RequiredHeader,
    headerName: i18n.t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.levelOfEquipment'
    ),
    cellEditor: AutocompleteCellEditor,
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
      (!params.value && <BCTypography variant="body4">Select</BCTypography>)
  },
  {
    field: 'ports',
    headerName: i18n.t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.ports'
    ),
    minWidth: 220,
    cellEditor: AutocompleteCellEditor,
    suppressKeyboardEvent,
    cellEditorParams: {
      options: optionsData?.ports || [],
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true,
      clearable: true
    },
    cellStyle: (params) => StandardCellErrors(params, errors),
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <BCTypography variant="body4">Select</BCTypography>)
  },
  {
    field: 'fuelMeasurementType',
    headerComponent: RequiredHeader,
    headerName: i18n.t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.fuelMeasurementType'
    ),
    cellEditor: AutocompleteCellEditor,
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
      (!params.value && <BCTypography variant="body4">Select</BCTypography>)
  },
  {
    field: 'intendedUses',
    headerComponent: RequiredHeader,
    headerName: i18n.t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.intendedUses'
    ),
    cellEditor: AutocompleteCellEditor,
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
      (!params.value && <BCTypography variant="body4">Select</BCTypography>),
    suppressKeyboardEvent,
    minWidth: 560
  },
  {
    field: 'intendedUsers',
    headerComponent: RequiredHeader,
    headerName: i18n.t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.intendedUsers'
    ),
    cellEditor: AutocompleteCellEditor,
    cellEditorParams: {
      options: optionsData?.intendedUserTypes.map((obj) => obj.typeName) || [],
      multiple: true,
      disableCloseOnSelect: true,
      openOnFocus: true
    },
    cellStyle: (params) => StandardCellErrors(params, errors),
    cellRenderer: (params) =>
      (params.value && params.value !== '' && (
        <CommonArrayRenderer disableLink {...params} />
      )) ||
      (!params.value && <BCTypography variant="body4">Select</BCTypography>),
    suppressKeyboardEvent,
    minWidth: 315
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
  filter: false,
  floatingFilter: false,
  sortable: false,
  singleClickEdit: true
}
