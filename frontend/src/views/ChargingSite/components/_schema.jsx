import { suppressKeyboardEvent } from '@/utils/grid/eventHandlers'
import BCTypography from '@/components/BCTypography'
import {
  AsyncSuggestionEditor,
  AutocompleteCellEditor,
  BCSelectFloatingFilter,
  RequiredHeader,
  TextCellEditor
} from '@/components/BCDataGrid/components'
import i18n from '@/i18n'
import { actions, validation } from '@/components/BCDataGrid/columns'
import {
  ChargingSiteStatusRenderer,
  CommonArrayRenderer,
  createStatusRenderer,
  MultiSelectRenderer
} from '@/utils/grid/cellRenderers'
import { StandardCellWarningAndErrors } from '@/utils/grid/errorRenderers'
import { apiRoutes } from '@/constants/routes'
import { numberFormatter } from '@/utils/formatters.js'
import {
  useChargingEquipmentStatuses,
  useChargingSiteStatuses
} from '@/hooks/useChargingSite'

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

export const chargingSiteColDefs = (errors, warnings, gridReady) => {
  return [
    validation,
    actions((params) => ({
      enableDuplicate: false,
      enableDelete: !params.data.isNewSupplementalEntry,
      enableUndo: false,
      enableStatus: false
    })),
    {
      field: 'id',
      cellEditor: 'agTextCellEditor',
      cellDataType: 'text',
      hide: true
    },
    {
      field: 'chargingSiteId',
      headerName: i18n.t('chargingSite:columnLabels.chargingSiteId'),
      cellEditor: 'agTextCellEditor',
      cellDataType: 'text',
      hide: true
    },
    {
      field: 'siteName',
      headerComponent: RequiredHeader,
      headerName: i18n.t('chargingSite:columnLabels.siteName'),
      cellEditor: 'agTextCellEditor',
      cellDataType: 'text',
      minWidth: 310,
      editable: true,
      valueGetter: (params) => {
        return params.data?.siteName || ''
      },
      tooltipValueGetter: (p) => 'Enter a unique site identifier name'
    },
    {
      field: 'streetAddress',
      headerComponent: RequiredHeader,
      headerName: i18n.t('chargingSite:columnLabels.streetAddress'),
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
      headerName: i18n.t('chargingSite:columnLabels.city'),
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
      headerName: i18n.t('chargingSite:columnLabels.postalCode'),
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
      headerName: i18n.t('chargingSite:columnLabels.latitude'),
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
      headerName: i18n.t('chargingSite:columnLabels.longitude'),
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
      headerName: i18n.t('chargingSite:columnLabels.notes'),
      cellEditor: 'agTextCellEditor',
      minWidth: 500,
      editable: true
    }
  ]
}

export const chargingEquipmentColDefs = (t, isIDIR = false) => {
  return [
    {
      field: 'status',
      minWidth: 175,
      filter: true,
      headerName: t('fseColumnLabels.status'),
      valueGetter: (params) => {
        return params.data?.status?.status || ''
      },
      cellRenderer: createStatusRenderer(
        {
          Draft: 'info',
          Updated: 'info',
          Submitted: 'warning',
          Validated: 'success',
          Decommissioned: 'error'
        },
        { statusField: 'status', replaceUnderscores: false }
      ),
      cellClass: 'vertical-middle',
      floatingFilterComponent: BCSelectFloatingFilter,
      floatingFilterComponentParams: {
        valueKey: 'status',
        labelKey: 'status',
        optionsQuery: useChargingEquipmentStatuses
      },
      suppressFloatingFilterButton: true,
      filterParams: {
        textMatcher: () => {
          return true
        }
      }
    },
    {
      field: 'siteName',
      headerName: t('fseColumnLabels.siteName'),
      sortable: false,
      minWidth: 310,
      valueGetter: (params) => params.data?.chargingSite?.siteName || ''
    },
    {
      field: 'registrationNumber',
      sortable: false,
      minWidth: 180,
      headerName: t('fseColumnLabels.registrationNumber')
    },
    {
      field: 'version',
      headerName: t('fseColumnLabels.version')
    },
    {
      field: 'allocatingOrganization',
      minWidth: 400,
      headerName: t('fseColumnLabels.allocatingOrg'),
      valueGetter: (params) => {
        return (
          params.data?.allocatingOrganization?.name ||
          params.data?.organizationName
        )
      }
    },
    {
      field: 'serialNumber',
      minWidth: 220,
      headerName: t('fseColumnLabels.serialNumber')
    },
    {
      field: 'manufacturer',
      minWidth: 320,
      headerName: t('fseColumnLabels.manufacturer')
    },
    {
      field: 'model',
      minWidth: 220,
      headerName: t('fseColumnLabels.model')
    },
    {
      field: 'levelOfEquipment',
      minWidth: 400,
      sortable: false,
      valueGetter: (params) => {
        return params.data?.levelOfEquipment?.name || ''
      },
      headerName: t('fseColumnLabels.levelOfEquipment')
    },
    {
      field: 'ports',
      headerName: t('fseColumnLabels.ports')
    },
    {
      field: 'fuelMeasurementType',
      minWidth: 250,
      headerName: t('fseColumnLabels.fuelMeasurementType')
    },
    {
      field: 'intendedUse',
      headerName: t('fseColumnLabels.intendedUse'),
      sortable: false,
      minWidth: 380,
      valueGetter: (params) =>
        params.data?.intendedUseTypes?.map((i) => i.type),
      cellRenderer: CommonArrayRenderer,
      cellRendererParams: { disableLink: true }
    },
    {
      field: 'latitude',
      sortable: false,
      headerName: t('fseColumnLabels.latitude'),
      valueGetter: (params) => params.data?.chargingSite?.latitude || ''
    },
    {
      field: 'longitude',
      sortable: false,
      headerName: t('fseColumnLabels.longitude'),
      valueGetter: (params) => params.data?.chargingSite?.longitude || ''
    },
    {
      field: 'notes',
      minWidth: 600,
      headerName: t('fseColumnLabels.notes')
    }
  ]
}

export const defaultColDef = {
  editable: false,
  resizable: true,
  filter: false,
  floatingFilter: false,
  sortable: false,
  singleClickEdit: true
}

// Column defs for IDIR Charging Sites viewer grid
export const indexChargingSitesColDefs = (isIDIR = false, orgIdToName = {}) => [
  {
    field: 'status',
    minWidth: 130,
    filter: true,
    headerName: i18n.t('chargingSite:columnLabels.status'),
    valueGetter: (params) => params.data?.status?.status || '',
    floatingFilterComponent: BCSelectFloatingFilter,
    floatingFilterComponentParams: {
      suppressFilterButton: true,
      valueKey: 'status',
      labelKey: 'status',
      optionsQuery: useChargingSiteStatuses
    },
    cellRenderer: ChargingSiteStatusRenderer
  },
  {
    field: 'organization',
    headerName: i18n.t('chargingSite:columnLabels.organization'),
    hide: !isIDIR,
    minWidth: 310,
    filter: true,
    sortable: true,
    valueGetter: (params) =>
      params.data?.organization?.name ||
      orgIdToName[params.data?.organizationId] ||
      ''
  },
  {
    field: 'siteName',
    filter: true,
    sortable: true,
    minWidth: 310,
    headerName: i18n.t('chargingSite:columnLabels.siteName')
  },
  {
    field: 'siteCode',
    filter: true,
    sortable: true,
    minWidth: 140,
    headerName: i18n.t('chargingSite:columnLabels.siteNumber')
  },
  {
    field: 'streetAddress',
    filter: true,
    sortable: true,
    minWidth: 260,
    headerName: i18n.t('chargingSite:columnLabels.streetAddress')
  },
  {
    field: 'city',
    filter: true,
    sortable: true,
    minWidth: 220,
    headerName: i18n.t('chargingSite:columnLabels.city')
  },
  {
    field: 'postalCode',
    filter: true,
    sortable: true,
    minWidth: 135,
    headerName: i18n.t('chargingSite:columnLabels.postalCode')
  },
  {
    field: 'intendedUsers',
    headerName: i18n.t('chargingSite:columnLabels.intendedUsers'),
    minWidth: 315,
    valueGetter: (params) =>
      params.data?.intendedUsers?.map((u) => u.typeName) || [],
    cellRenderer: CommonArrayRenderer
  },
  {
    field: 'actions',
    headerName: 'Actions',
    minWidth: 180,
    sortable: false,
    filter: false,
    hide: !isIDIR,
    cellRenderer: (params) => {
      if (!isIDIR) return null

      const siteId = params.data?.chargingSiteId
      if (!siteId) return null

      const navigate = window.navigateToFSEProcessing || (() => {})

      return `
        <button
          class="fse-processing-btn"
          onclick="window.navigateToFSEProcessing('${siteId}')"
          style="
            background: #003366;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 6px 12px;
            cursor: pointer;
            font-size: 12px;
          "
        >
          FSE Processing
        </button>
      `
    }
  },
  {
    field: 'notes',
    filter: true,
    minWidth: 500,
    headerName: i18n.t('chargingSite:columnLabels.notes')
  }
]

export const indexDefaultColDef = {
  editable: false,
  resizable: true,
  filter: false,
  floatingFilter: true,
  suppressFloatingFilterButton: true,
  sortable: false
}
