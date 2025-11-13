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
import { dateFormatter, numberFormatter } from '@/utils/formatters.js'
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

export const chargingSiteColDefs = (
  allocationOrganizations,
  errors,
  warnings,
  gridReady
) => {
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
      field: 'allocatingOrganization',
      headerName: i18n.t('chargingSite:columnLabels.allocatingOrganization'),
      valueGetter: (params) => {
        // Hybrid approach: prefer ID, fallback to name
        const storedId = params.data?.allocatingOrganizationId
        const storedName = params.data?.allocatingOrganizationName

        // If we have an ID, find the org by ID
        if (storedId) {
          const matchingOrg = allocationOrganizations?.find(
            (org) => org.organizationId === storedId
          )
          if (matchingOrg) {
            return {
              label: matchingOrg.name,
              value: matchingOrg.organizationId,
              organizationId: matchingOrg.organizationId,
              name: matchingOrg.name
            }
          }
        }

        // If we have a name but no ID, try to find by name
        if (storedName) {
          const matchingOrg = allocationOrganizations?.find(
            (org) => org.name === storedName
          )
          if (matchingOrg) {
            return {
              label: matchingOrg.name,
              value: matchingOrg.organizationId,
              organizationId: matchingOrg.organizationId,
              name: matchingOrg.name
            }
          }

          // Return as simple text if not in list
          return {
            label: storedName,
            value: null,
            organizationId: null,
            name: storedName
          }
        }

        return null
      },
      valueSetter: (params) => {
        // Store both the ID and name (hybrid approach)
        if (params.newValue === '' || params.newValue === null) {
          params.data.allocatingOrganizationId = null
          params.data.allocatingOrganizationName = null
        } else if (typeof params.newValue === 'string') {
          // Custom text input - try to match to an org
          const matchingOrg = allocationOrganizations?.find(
            (org) => org.name.toLowerCase() === params.newValue.toLowerCase()
          )
          if (matchingOrg) {
            params.data.allocatingOrganizationId = matchingOrg.organizationId
            params.data.allocatingOrganizationName = matchingOrg.name
          } else {
            // No match, store as name only
            params.data.allocatingOrganizationId = null
            params.data.allocatingOrganizationName = params.newValue
          }
        } else {
          // Object from autocomplete
          params.data.allocatingOrganizationId =
            params.newValue?.organizationId || null
          params.data.allocatingOrganizationName =
            params.newValue?.name || params.newValue?.label || null
        }
        return true
      },
      valueFormatter: (params) => params.value?.name || params.value || '',
      cellEditor: AutocompleteCellEditor,
      cellEditorParams: {
        options:
          allocationOrganizations?.map((obj) => ({
            label: obj.name,
            value: obj.organizationId,
            organizationId: obj.organizationId,
            name: obj.name
          })) || [],
        multiple: false,
        openOnFocus: true,
        returnObject: true
      },
      tooltipValueGetter: (p) =>
        !allocationOrganizations || allocationOrganizations.length === 0
          ? 'No allocation agreements found. You must first enter an allocation agreement in your compliance report to use this field.'
          : "Allocating organizations tied to your allocation agreements. If an organization isn't listed you must first enter an allocation agreement in your compliance report.",
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings),
      suppressKeyboardEvent,
      minWidth: 315,
      editable: allocationOrganizations && allocationOrganizations.length > 0
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

export const chargingEquipmentColDefs = (t, isIDIR = false, options = {}) => {
  const {
    enableSelection = false,
    showDateColumns = false,
    showIntendedUsers = false,
    showLocationFields = false,
    showPorts = false,
    showFuelMeasurement = false,
    showNotes = false,
    showOrganizationColumn = false
  } = options

  const cols = []

  // Add checkbox selection column if enabled (for list view)
  if (enableSelection) {
    cols.push({
      headerName: '',
      field: '__select__',
      width: 52,
      minWidth: 52,
      maxWidth: 60,
      pinned: 'left',
      lockPinned: true,
      filter: false,
      sortable: false,
      suppressHeaderMenuButton: true,
      checkboxSelection: (params) => {
        const status = params.data?.status
        return status !== 'Decommissioned' && status !== 'Submitted'
      },
      headerCheckboxSelection: true,
      headerCheckboxSelectionFilteredOnly: true,
      suppressSizeToFit: true
    })
  }

  // Status column
  cols.push({
    field: 'status',
    minWidth: 175,
    filter: true,
    headerName: t('chargingSite:fseColumnLabels.status'),
    valueGetter: (params) => {
      return params.data?.status?.status || params.data?.status || ''
    },
    cellRenderer: createStatusRenderer(
      {
        Draft: 'info',
        Updated: 'info',
        Submitted: 'warning',
        Validated: 'success',
        Decommissioned: enableSelection ? 'smoky' : 'error'
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
      values: ['Draft', 'Updated', 'Submitted', 'Validated', 'Decommissioned']
    }
  })

  // Site Name column
  cols.push({
    field: 'siteName',
    headerName: t('chargingSite:fseColumnLabels.siteName'),
    sortable: false,
    flex: enableSelection ? 1 : undefined,
    minWidth: 310,
    valueGetter: (params) =>
      params.data.chargingSite?.siteName || params.data.siteName || ''
  })

  // Organization column for IDIR users in list view
  if (showOrganizationColumn) {
    cols.push({
      field: 'organizationName',
      headerName: t('chargingSite:fseColumnLabels.organizationName'),
      flex: 1,
      minWidth: 200
    })
  }

  // Registration Number
  cols.push({
    field: 'registrationNumber',
    headerName: t('chargingSite:fseColumnLabels.registrationNumber'),
    sortable: false,
    minWidth: 180
  })

  // Version
  cols.push({
    field: 'version',
    headerName: t('chargingSite:fseColumnLabels.version'),
    minWidth: 120,
    type: enableSelection ? 'numericColumn' : undefined
  })

  // Serial Number
  cols.push({
    field: 'serialNumber',
    headerName: t('chargingSite:fseColumnLabels.serialNumber'),
    minWidth: 220
  })

  // Manufacturer
  cols.push({
    field: 'manufacturer',
    headerName: t('chargingSite:fseColumnLabels.manufacturer'),
    minWidth: 320
  })

  // Model
  cols.push({
    field: 'model',
    headerName: t('chargingSite:fseColumnLabels.model'),
    minWidth: 220
  })

  // Level of Equipment
  cols.push({
    field: 'levelOfEquipment',
    headerName: t('chargingSite:fseColumnLabels.levelOfEquipment'),
    minWidth: 400,
    sortable: false,
    valueGetter: (params) =>
      params.data.levelOfEquipment?.name ||
      params.data.levelOfEquipmentName ||
      ''
  })
  // ports
  cols.push({
    field: 'ports',
    headerName: t('chargingSite:fseColumnLabels.ports'),
    minWidth: 160,
    sortable: false
  })

  // Intended Uses
  cols.push({
    field: enableSelection ? 'intended_uses' : 'intendedUse',
    headerName: t('chargingSite:fseColumnLabels.intendedUse'),
    minWidth: 380,
    sortable: false,
    valueGetter: (params) => {
      const intendedUseTypes =
        params.data.intendedUseTypes || params.data.intendedUses || []
      return intendedUseTypes?.map((i) => i.type)
    },
    valueFormatter: (params) => {
      if (!params.value || !Array.isArray(params.value)) return ''
      return params.value.map((use) => use.type || use).join(', ')
    },
    cellRenderer: CommonArrayRenderer,
    cellRendererParams: { disableLink: true }
  })

  // Intended Users
  if (showIntendedUsers) {
    cols.push({
      field: enableSelection ? 'intended_users' : 'intendedUsers',
      headerName: t('chargingSite:fseColumnLabels.intendedUsers'),
      minWidth: 380,
      sortable: false,
      valueGetter: (params) => {
        // Handle both data structures: intendedUserTypes (site view) and intended_users (list view)
        const intendedUsers =
          params.data.intendedUsers || params.data.intendedUserTypes || []
        return intendedUsers?.map((i) => i.typeName)
      },
      valueFormatter: (params) => {
        if (!params.value || !Array.isArray(params.value)) return ''
        return params.value.join(', ')
      },
      cellRenderer: CommonArrayRenderer,
      cellRendererParams: { disableLink: true }
    })
  }

  // Date columns (only for list view)
  if (showDateColumns) {
    cols.push(
      {
        field: 'createdDate',
        headerName: t('chargingSite:fseColumnLabels.created'),
        minWidth: 150,
        type: 'dateColumn',
        valueFormatter: dateFormatter
      },
      {
        field: 'updatedDate',
        headerName: t('chargingSite:fseColumnLabels.lastUpdated'),
        minWidth: 150,
        type: 'dateColumn',
        valueFormatter: dateFormatter
      }
    )
  }

  // Location fields (only for site view)
  if (showLocationFields) {
    cols.push(
      {
        field: 'latitude',
        sortable: false,
        headerName: t('chargingSite:fseColumnLabels.latitude'),
        valueGetter: (params) => params.data?.chargingSite?.latitude || ''
      },
      {
        field: 'longitude',
        sortable: false,
        headerName: t('chargingSite:fseColumnLabels.longitude'),
        valueGetter: (params) => params.data?.chargingSite?.longitude || ''
      }
    )
  }

  // Notes (only for site view)
  if (showNotes) {
    cols.push({
      field: 'notes',
      minWidth: 600,
      headerName: t('chargingSite:fseColumnLabels.notes')
    })
  }

  return cols
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
    field: 'allocatingOrganization',
    headerName: i18n.t('chargingSite:columnLabels.allocatingOrganization'),
    minWidth: 250,
    valueGetter: (params) => {
      // Hybrid approach: prefer the org object name, fallback to text name
      return (
        params.data?.allocatingOrganization?.name ||
        params.data?.allocatingOrganizationName ||
        ''
      )
    },
    filter: true,
    sortable: true
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
