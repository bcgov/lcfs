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
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { sortMixedStrings } from './components/utils'

// Helper function for address autocomplete within grid
const addressAutocompleteQuery = async ({ client, queryKey }) => {
  const partialAddress = queryKey[1]
  if (!partialAddress || partialAddress.length < 3) {
    return []
  }

  try {
    // Use the new geocoder API endpoint with authenticated client
    const response = await client.post(apiRoutes.geocoderAutocomplete, {
      partial_address: partialAddress,
      max_results: 5
    })

    const data = response.data

    // Return in the format expected by AsyncSuggestionEditor
    // Now suggestions come as complete AddressSchema objects
    return (
      data.suggestions?.map((addr) => ({
        label: addr.full_address,
        fullAddress: addr.full_address,
        streetAddress: addr.street_address,
        city: addr.city,
        province: addr.province,
        postalCode: addr.postal_code,
        latitude: addr.latitude,
        longitude: addr.longitude,
        score: addr.score
      })) || []
    )
  } catch (error) {
    console.error('Address autocomplete failed:', error)
    return []
  }
}

export const finalSupplyEquipmentColDefs = (
  optionsData,
  compliancePeriod,
  errors,
  warnings,
  gridReady
) => {
  return [
    validation,
    actions((params) => ({
      enableDuplicate: true,
      enableDelete: !params.data.isNewSupplementalEntry,
      enableUndo: false, // FSE doesn't use supplemental logic yet
      enableStatus: false
    })),
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
      editable: true,
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
      editable: true,
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
      editable: true,
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
      editable: true,
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
      editable: true,
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
      editable: true,
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
      editable: true,
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
      suppressKeyboardEvent,
      minWidth: 400,
      cellEditorParams: {
        options: optionsData?.levelsOfEquipment?.map((obj) => obj.name) || [],
        multiple: false,
        disableCloseOnSelect: false,
        freeSolo: false,
        openOnFocus: true,
        clearable: true
      },
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings),
      cellRenderer: SelectRenderer,
      editable: true
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
      editable: true
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
        options: optionsData?.intendedUseTypes?.map((obj) => obj.type) || [],
        multiple: true,
        disableCloseOnSelect: true,
        openOnFocus: true
      },
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings),
      cellRenderer: MultiSelectRenderer,
      suppressKeyboardEvent,
      minWidth: 560,
      editable: true
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
        options:
          optionsData?.intendedUserTypes?.map((obj) => obj.typeName) || [],
        multiple: true,
        disableCloseOnSelect: true,
        openOnFocus: true
      },
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings),
      cellRenderer: MultiSelectRenderer,
      suppressKeyboardEvent,
      minWidth: 315,
      editable: true
    },
    {
      field: 'streetAddress',
      headerComponent: RequiredHeader,
      headerName: i18n.t(
        'finalSupplyEquipment:finalSupplyEquipmentColLabels.streetAddress'
      ),
      cellEditor: AsyncSuggestionEditor,
      cellEditorParams: (params) => ({
        queryKey: 'address-autocomplete',
        queryFn: addressAutocompleteQuery,
        optionLabel: 'label'
      }),
      valueSetter: async (params) => {
        if (params.newValue === '' || params.newValue?.name === '') {
          params.data.streetAddress = ''
          params.data.city = ''
          params.data.postalCode = ''
          params.data.latitude = ''
          params.data.longitude = ''
        } else if (typeof params.newValue === 'string') {
          // Directly set the street address if it's a custom input
          params.data.streetAddress = params.newValue
        } else if (params.newValue?.fullAddress) {
          // Address selected from autocomplete - we already have all the data
          params.data.streetAddress =
            params.newValue.streetAddress || params.newValue.fullAddress
          params.data.city = params.newValue.city || ''
          params.data.postalCode = params.newValue.postalCode || ''
          params.data.latitude = params.newValue.latitude || ''
          params.data.longitude = params.newValue.longitude || ''
        } else if (params.newValue?.label && params.newValue?.coordinates) {
          // Handle geocoder API response format with label and coordinates
          const addressParts = params.newValue.label.split(', ')
          params.data.streetAddress = addressParts[0] || ''
          params.data.city = addressParts[1] || ''
          params.data.postalCode = addressParts[2] || ''
          params.data.latitude = params.newValue.coordinates[1] || ''
          params.data.longitude = params.newValue.coordinates[0] || ''
        }
        return true
      },
      cellDataType: 'object',
      suppressKeyboardEvent,
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings),
      minWidth: 260,
      editable: true
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
      editable: true
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
      editable: true
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
      editable: true
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
      editable: true
    },
    {
      field: 'notes',
      headerName: i18n.t(
        'finalSupplyEquipment:finalSupplyEquipmentColLabels.notes'
      ),
      cellEditor: 'agTextCellEditor',
      minWidth: 500,
      editable: true
    }
  ]
}

export const finalSupplyEquipmentSummaryColDefs = (t, status) => [
  {
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.organizationName'
    ),
    minWidth: 300,
    field: 'organizationName'
  },
  {
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.supplyFromDate'
    ),
    minWidth: 210,
    field: 'supplyFromDate'
  },
  {
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.supplyToDate'
    ),
    minWidth: 190,
    field: 'supplyToDate'
  },
  {
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.kwhUsage'
    ),
    minWidth: 135,
    field: 'kwhUsage',
    valueFormatter: numberFormatter
  },
  {
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.registrationNbr'
    ),
    field: 'registrationNumber',
    hide: true
  },
  {
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.serialNbr'
    ),
    minWidth: 200,
    field: 'serialNumber'
  },
  {
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.manufacturer'
    ),
    minWidth: 250,
    field: 'manufacturer'
  },
  {
    headerName: t('finalSupplyEquipment:finalSupplyEquipmentColLabels.model'),
    minWidth: 200,
    field: 'model'
  },
  {
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.levelOfEquipment'
    ),
    minWidth: 340,
    field: 'levelOfEquipment',
    valueGetter: (params) => params.data.levelOfEquipment
  },
  {
    headerName: t('finalSupplyEquipment:finalSupplyEquipmentColLabels.ports'),
    minWidth: 130,
    field: 'ports'
  },
  {
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.intendedUseTypes'
    ),
    minWidth: 250,
    field: 'intendedUses',
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
    field: 'intendedUsers',
    minWidth: 200,
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
    minWidth: 300,
    field: 'streetAddress'
  },
  {
    headerName: t('finalSupplyEquipment:finalSupplyEquipmentColLabels.city'),
    minWidth: 180,
    field: 'city'
  },
  {
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.postalCode'
    ),
    minWidth: 140,
    field: 'postalCode'
  },
  {
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.latitude'
    ),
    minWidth: 150,
    field: 'latitude'
  },
  {
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.longitude'
    ),
    minWidth: 150,
    field: 'longitude'
  },
  {
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.complianceNotes'
    ),
    minWidth: 300,
    field: 'complianceNotes'
  },
  {
    headerName: t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.equipmentNotes'
    ),
    minWidth: 300,
    field: 'equipmentNotes'
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

export const getFSEReportingColDefs = (
  minDate,
  maxDate,
  errors = {},
  warnings = {},
  complianceReportId,
  complianceReportGroupUuid
) => [
  validation,
  {
    field: 'chargingEquipmentComplianceId',
    headerName: i18n.t('finalSupplyEquipment:chargingEquipmentComplianceId'),
    editable: false,
    hide: true
  },
  {
    field: 'supplyFromDate',
    filter: false,
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
      minDate,
      maxDate,
      autoOpenLastRow: false
    },
    editable: (params) => params.data.complianceReportGroupUuid === complianceReportGroupUuid,
    valueGetter: (params) => {
      return params.data.supplyFromDate || minDate
    },
    valueSetter: (params) => {
      params.data.supplyFromDate = params.newValue
      return true
    }
  },
  {
    field: 'supplyToDate',
    filter: false,
    sortable: false,
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
      minDate,
      maxDate,
      autoOpenLastRow: false
    },
    editable: (params) => params.data.complianceReportGroupUuid === complianceReportGroupUuid,
    valueGetter: (params) => {
      return params.data.supplyToDate || maxDate
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
    valueGetter: (params) => params.data.kwhUsage || 0,
    cellEditor: NumberEditor,
    type: 'numericColumn',
    cellEditorParams: {
      precision: 0,
      min: 0,
      showStepperButtons: false
    },
    editable: (params) => params.data.complianceReportGroupUuid === complianceReportGroupUuid,
    filter: false,
    sortable: false,
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings)
  },
  {
    field: 'complianceNotes',
    filter: true,
    sortable: false,
    headerName: i18n.t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.complianceNotes'
    ),
    editable: (params) => params.data.complianceReportGroupUuid === complianceReportGroupUuid,
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
    cellEditor: 'agTextCellEditor',
    minWidth: 400
  },
  {
    field: 'siteName',
    headerName: i18n.t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.siteName'
    ),
    editable: false,
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
    minWidth: 220
  },
  {
    field: 'streetAddress',
    headerName: i18n.t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.streetAddress'
    ),
    editable: false,
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
    minWidth: 220
  },
  {
    field: 'serialNumber',
    headerName: i18n.t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.serialNbr'
    ),
    editable: false,
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
    minWidth: 280
  },
  {
    field: 'model',
    headerName: i18n.t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.model'
    ),
    editable: false,
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
    minWidth: 150
  },
  {
    field: 'equipmentNotes',
    headerName: i18n.t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.equipmentNotes'
    ),
    editable: false,
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
    minWidth: 300
  },
  {
    field: 'registrationNumber',
    headerName: i18n.t(
      'finalSupplyEquipment:finalSupplyEquipmentColLabels.registrationNbr'
    ),
    editable: false,
    filter: false,
    sortable: false,
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
    minWidth: 150
  }
]
