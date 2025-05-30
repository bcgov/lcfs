import { suppressKeyboardEvent } from '@/utils/grid/eventHandlers'
import BCTypography from '@/components/BCTypography'
import {
  AsyncSuggestionEditor,
  AutocompleteCellEditor,
  DateEditor,
  NumberEditor,
  RequiredHeader,
  TextCellEditor
} from '@/components/BCDataGrid/components'
import i18n from '@/i18n'
import { actions, validation } from '@/components/BCDataGrid/columns'
import dayjs from 'dayjs'
import {
  CommonArrayRenderer,
  MultiSelectRenderer,
  SelectRenderer
} from '@/utils/grid/cellRenderers'
import { StandardCellWarningAndErrors } from '@/utils/grid/errorRenderers'
import { apiRoutes } from '@/constants/routes'
import { numberFormatter } from '@/utils/formatters.js'
import { ADDRESS_SEARCH_URL } from '@/constants/common'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { sortMixedStrings } from './components/utils'

export const finalSupplyEquipmentColDefs = (
  optionsData,
  compliancePeriod,
  errors,
  warnings,
  gridReady,
  status = null
) => {
  // Define which statuses allow editing - be explicit and secure
  const isEditable =
    status === COMPLIANCE_REPORT_STATUSES.DRAFT ||
    status === COMPLIANCE_REPORT_STATUSES.ANALYST_ADJUSTMENT

  return [
    validation,
    actions({
      enableDuplicate: isEditable,
      enableDelete: isEditable
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
      cellRenderer: SelectRenderer,
      cellEditorParams: {
        options: sortMixedStrings(optionsData?.organizationNames ?? []),
        multiple: false,
        disableCloseOnSelect: false,
        freeSolo: true,
        openOnFocus: true
      },
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings),
      suppressKeyboardEvent,
      minWidth: 260,
      editable: isEditable,
      valueGetter: (params) => {
        return params.data?.organizationName || ''
      },
      valueSetter: (params) => {
        if (params.newValue) {
          const isValidOrganizationName =
            optionsData?.organizationNames.includes(params.newValue)

          params.data.organizationName = isValidOrganizationName
            ? params.newValue
            : params.newValue
          return true
        }
        return false
      },
      tooltipValueGetter: (params) =>
        'Select the organization name from the list'
    },
    {
      field: 'supplyFromDate',
      headerName: i18n.t(
        'finalSupplyEquipment:finalSupplyEquipmentColLabels.supplyFromDate'
      ),
      headerComponent: RequiredHeader,
      minWidth: 200,
      cellRenderer: (params) => (
        <BCTypography variant="body4">
          {params.value ? params.value : 'YYYY-MM-DD'}
        </BCTypography>
      ),
      suppressKeyboardEvent,
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings),
      cellEditor: DateEditor,
      cellEditorParams: {
        minDate: dayjs(`${compliancePeriod}-01-01`, 'YYYY-MM-DD').toDate(),
        maxDate: dayjs(`${compliancePeriod}-12-31`, 'YYYY-MM-DD').toDate(),
        autoOpenLastRow: !gridReady
      },
      editable: isEditable,
      valueGetter: (params) => {
        return params.data.supplyFromDate || `${compliancePeriod}-01-01`
      },
      valueSetter: (params) => {
        params.data.supplyFromDate = params.newValue
        return true
      }
    },
    {
      field: 'supplyToDate',
      headerName: i18n.t(
        'finalSupplyEquipment:finalSupplyEquipmentColLabels.supplyToDate'
      ),
      headerComponent: RequiredHeader,
      minWidth: 200,
      cellRenderer: (params) => (
        <BCTypography variant="body4">
          {params.value ? params.value : 'YYYY-MM-DD'}
        </BCTypography>
      ),
      suppressKeyboardEvent,
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings),
      cellEditor: DateEditor,
      cellEditorParams: {
        minDate: dayjs(`${compliancePeriod}-01-01`, 'YYYY-MM-DD').toDate(),
        maxDate: dayjs(`${compliancePeriod}-12-31`, 'YYYY-MM-DD').toDate(),
        autoOpenLastRow: !gridReady
      },
      editable: isEditable,
      valueGetter: (params) => {
        return params.data.supplyToDate || `${compliancePeriod}-12-31`
      },
      valueSetter: (params) => {
        params.data.supplyToDate = params.newValue
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
      editable: isEditable,
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings)
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
      editable: isEditable,
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings)
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
      editable: isEditable,
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings)
    },
    {
      field: 'model',
      headerName: i18n.t(
        'finalSupplyEquipment:finalSupplyEquipmentColLabels.model'
      ),
      minWidth: 220,
      cellEditor: 'agTextCellEditor',
      cellDataType: 'text',
      editable: isEditable,
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings)
    },
    {
      field: 'levelOfEquipment',
      headerComponent: RequiredHeader,
      headerName: i18n.t(
        'finalSupplyEquipment:finalSupplyEquipmentColLabels.levelOfEquipment'
      ),
      cellEditor: AutocompleteCellEditor,
      cellEditorParams: {
        options: optionsData?.levelsOfEquipment || [],
        multiple: false,
        disableCloseOnSelect: false,
        freeSolo: false,
        openOnFocus: true,
        clearable: true
      },
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings),
      cellRenderer: SelectRenderer,
      editable: isEditable
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
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings),
      cellRenderer: SelectRenderer,
      editable: isEditable
    },
    {
      field: 'intendedUseTypes',
      headerComponent: RequiredHeader,
      headerName: i18n.t(
        'finalSupplyEquipment:finalSupplyEquipmentColLabels.intendedUseTypes'
      ),
      valueGetter: (params) => params.data?.intendedUseTypes,
      cellEditor: AutocompleteCellEditor,
      cellEditorParams: {
        options: optionsData?.intendedUseTypes.map((obj) => obj.type) || [],
        multiple: true,
        disableCloseOnSelect: true,
        openOnFocus: true
      },
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings),
      cellRenderer: MultiSelectRenderer,
      suppressKeyboardEvent,
      minWidth: 560,
      editable: isEditable
    },
    {
      field: 'intendedUserTypes',
      headerComponent: RequiredHeader,
      headerName: i18n.t(
        'finalSupplyEquipment:finalSupplyEquipmentColLabels.intendedUserTypes'
      ),
      valueGetter: (params) => params.data?.intendedUserTypes,
      cellEditor: AutocompleteCellEditor,
      cellEditorParams: {
        options: optionsData?.intendedUserTypes.map((obj) => obj.typeName) || [],
        multiple: true,
        disableCloseOnSelect: true,
        openOnFocus: true
      },
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings),
      cellRenderer: MultiSelectRenderer,
      suppressKeyboardEvent,
      minWidth: 315,
      editable: isEditable
    },
    {
      field: 'streetAddress',
      headerComponent: RequiredHeader,
      headerName: i18n.t(
        'finalSupplyEquipment:finalSupplyEquipmentColLabels.streetAddress'
      ),
      cellEditor: AsyncSuggestionEditor,
      cellEditorParams: (params) => ({
        queryKey: 'fuel-code-search',
        queryFn: async ({ queryKey, client }) => {
          const response = await fetch(
            ADDRESS_SEARCH_URL + encodeURIComponent(queryKey[1])
          )
          if (!response.ok) throw new Error('Network response was not ok')
          const data = await response.json()
          return data.features.map((feature) => ({
            label: feature.properties.fullAddress || '',
            coordinates: feature.geometry.coordinates
          }))
        },
        optionLabel: 'label'
      }),
      valueSetter: async (params) => {
        if (params.newValue === '' || params.newValue?.name === '') {
          params.data.streetAddress = ''
          params.data.city = ''
          params.data.latitude = ''
          params.data.longitude = ''
        } else if (typeof params.newValue === 'string') {
          // Directly set the street address if it's a custom input
          params.data.streetAddress = params.newValue
        } else {
          const [street = '', city = '', province = ''] = params.newValue.label
            .split(',')
            .map((val) => val.trim())
          const [long, lat] = params.newValue.coordinates
          params.data.streetAddress = street
          params.data.city = city
          params.data.latitude = lat
          params.data.longitude = long
        }
        return true
      },
      cellDataType: 'object',
      suppressKeyboardEvent,
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings),
      minWidth: 260,
      editable: isEditable
    },
    {
      field: 'city',
      headerComponent: RequiredHeader,
      headerName: i18n.t(
        'finalSupplyEquipment:finalSupplyEquipmentColLabels.city'
      ),
      cellEditor: 'agTextCellEditor',
      cellDataType: 'text',
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings),
      minWidth: 260,
      editable: isEditable
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
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings),
      minWidth: 150,
      editable: isEditable
    },
    {
      field: 'latitude',
      headerComponent: RequiredHeader,
      headerName: i18n.t(
        'finalSupplyEquipment:finalSupplyEquipmentColLabels.latitude'
      ),
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: {
        precision: 6,
        max: 90,
        min: -90,
        showStepperButtons: false
      },
      cellDataType: 'number',
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings),
      minWidth: 150,
      editable: isEditable
    },
    {
      field: 'longitude',
      headerComponent: RequiredHeader,
      headerName: i18n.t(
        'finalSupplyEquipment:finalSupplyEquipmentColLabels.longitude'
      ),
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: {
        precision: 6,
        max: 180,
        min: -180,
        showStepperButtons: false
      },
      cellDataType: 'number',
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings),
      minWidth: 150,
      editable: isEditable
    },
    {
      field: 'notes',
      headerName: i18n.t(
        'finalSupplyEquipment:finalSupplyEquipmentColLabels.notes'
      ),
      cellEditor: 'agTextCellEditor',
      minWidth: 500,
      editable: isEditable
    }
  ]
}

export const finalSupplyEquipmentSummaryColDefs = (t, status) => [
  {
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.organizationName'
    ),
    field: 'organizationName'
  },
  {
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.supplyFromDate'
    ),
    field: 'supplyFromDate'
  },
  {
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.supplyToDate'
    ),
    field: 'supplyToDate'
  },
  {
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.kwhUsage'
    ),
    field: 'kwhUsage',
    valueFormatter: numberFormatter
  },
  {
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.registrationNbr'
    ),
    field: 'registrationNbr',
    hide: true
  },
  {
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.serialNbr'
    ),
    field: 'serialNbr'
  },
  {
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.manufacturer'
    ),
    field: 'manufacturer'
  },
  {
    headerName: t('finalSupplyEquipment:finalSupplyEquipmentColLabels.model'),
    field: 'model'
  },
  {
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.levelOfEquipment'
    ),
    field: 'levelOfEquipment',
    valueGetter: (params) => params.data.levelOfEquipment
  },
  {
    headerName: t('finalSupplyEquipment:finalSupplyEquipmentColLabels.ports'),
    field: 'ports'
  },
  {
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.intendedUseTypes'
    ),
    field: 'intendedUseTypes',
    valueGetter: (params) => params.data.intendedUseTypes,
    cellRenderer: CommonArrayRenderer,
    cellRendererParams:
      status === COMPLIANCE_REPORT_STATUSES.DRAFT
        ? { marginTop: '0.7em' }
        : { marginTop: '0.7em', disableLink: true }
  },
  {
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.intendedUserTypes'
    ),
    field: 'intendedUserTypes',
    valueGetter: (params) => params.data.intendedUserTypes,
    cellRenderer: CommonArrayRenderer,
    cellRendererParams:
      status === COMPLIANCE_REPORT_STATUSES.DRAFT
        ? { marginTop: '0.7em' }
        : { marginTop: '0.7em', disableLink: true }
  },
  {
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.streetAddress'
    ),
    field: 'streetAddress'
  },
  {
    headerName: t('finalSupplyEquipment:finalSupplyEquipmentColLabels.city'),
    field: 'city'
  },
  {
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.postalCode'
    ),
    field: 'postalCode'
  },
  {
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.latitude'
    ),
    field: 'latitude'
  },
  {
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.longitude'
    ),
    field: 'longitude'
  },
  {
    headerName: t('finalSupplyEquipment:finalSupplyEquipmentColLabels.notes'),
    field: 'notes'
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