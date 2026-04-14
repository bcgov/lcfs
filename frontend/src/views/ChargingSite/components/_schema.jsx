import { suppressKeyboardEvent } from '@/utils/grid/eventHandlers'
import BCTypography from '@/components/BCTypography'
import BCButton from '@/components/BCButton'
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
import { StyledChip } from '@/components/StyledChip'
import { changelogCellStyle } from '@/utils/grid/changelogCellStyle'
import { ExpandLess, ExpandMore } from '@mui/icons-material'

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
      field: 'allocatingOrganization',
      headerName: i18n.t('chargingSite:columnLabels.allocatingOrganization'),
      cellDataType: 'object',
      cellEditor: AsyncSuggestionEditor,
      cellEditorParams: (params) => ({
        queryKey: 'allocating-org-search',
        queryFn: async ({ queryKey, client }) => {
          let path = apiRoutes.allocationOrganizationsSearch
          path += 'query=' + encodeURIComponent(queryKey[1] || '')
          const response = await client.get(path)
          params.node.data.apiDataCache = response.data
          return response.data
        },
        optionLabel: 'name',
        api: params.api,
        minWords: 1
      }),
      cellRenderer: (params) =>
        params.value ||
        (!params.value && (
          <BCTypography variant="body4">Enter or search a name</BCTypography>
        )),
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings),
      suppressKeyboardEvent,
      minWidth: 315,
      editable: true,
      valueGetter: (params) => params.data?.allocatingOrganizationName || '',
      valueSetter: (params) => {
        const { newValue: selectedOrg, data } = params

        if (typeof selectedOrg === 'object') {
          // Only update related fields if a match is found in the API data
          data.allocatingOrganizationId = selectedOrg?.organizationId || null
          data.allocatingOrganizationName = selectedOrg?.name || null
        } else {
          // If no match, only update the allocatingOrganizationName field
          data.allocatingOrganizationId = null
          data.allocatingOrganizationName = selectedOrg
        }

        return true
      },
      tooltipValueGetter: (p) =>
        'Enter or select the allocating organization name. Suggestions include organizations from your allocation agreements and previously entered values.'
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
    historyMode = false,
    onToggleHistory = null,
    expandedRows = new Set(),
    showDateColumns = false,
    showIntendedUsers = false,
    showLocationFields = true,
    showPorts = false,
    showFuelMeasurement = false,
    showNotes = false,
    showOrganizationColumn = false
  } = options

  const cols = []

  if (historyMode) {
    cols.push({
      field: '__historyToggle__',
      headerName: '',
      minWidth: 80,
      maxWidth: 80,
      pinned: 'left',
      lockPinned: true,
      sortable: false,
      filter: false,
      suppressHeaderMenuButton: true,
      cellRenderer: (params) => {
        if (!params.data?.isCurrentVersionRow || !params.data?.hasHistory)
          return null

        const isExpanded = expandedRows.has(params.data.registrationNumber)

        return (
          <BCButton
            variant="text"
            color="primary"
            onClick={(event) => {
              event.stopPropagation()
              onToggleHistory?.(params.data.registrationNumber)
            }}
            sx={{ minWidth: 0, px: 0.5 }}
            title={
              isExpanded
                ? t('chargingSite:buttons.collapseHistory')
                : t('chargingSite:buttons.expandHistory')
            }
          >
            {isExpanded ? (
              <ExpandLess sx={{ width: '1.2rem', height: '1.2rem' }} />
            ) : (
              <ExpandMore sx={{ width: '1.2rem', height: '1.2rem' }} />
            )}
          </BCButton>
        )
      }
    })
  }

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
        Decommissioned: 'error'
      },
      { statusField: 'status', replaceUnderscores: false }
    ),
    cellStyle: (params) =>
      historyMode &&
      params.data?.isHistoryVersion &&
      changelogCellStyle(params, 'status'),
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
    minWidth: 310,
    valueGetter: (params) =>
      params.data.chargingSite?.siteName || params.data.siteName || ''
  })

  // Organization column for IDIR users in list view
  if (showOrganizationColumn) {
    cols.push({
      field: 'organizationName',
      headerName: t('chargingSite:fseColumnLabels.organizationName'),
      minWidth: 200
    })
  }
  cols.push({
    field: 'allocatingOrganizationName',
    headerName: t('chargingSite:fseColumnLabels.allocatingOrg'),
    minWidth: 250,
    sortable: false,
    valueGetter: (params) =>
      params.data.chargingSite?.allocatingOrganizationName ||
      params.data.allocatingOrganizationName ||
      ''
  })

  // Registration Number
  cols.push({
    field: 'registrationNumber',
    headerName: t('chargingSite:fseColumnLabels.registrationNumber'),
    sortable: false,
    filter: false,
    minWidth: 180,
    cellRenderer: (params) => {
      const value = params.value || ''
      if (!params.data?.isHistoryVersion) return value
      return `↳ ${value}`
    }
  })

  // Version
  cols.push({
    field: 'version',
    headerName: t('chargingSite:fseColumnLabels.version'),
    minWidth: 120,
    filter: false,
    type: enableSelection ? 'numericColumn' : undefined,
    cellStyle: (params) =>
      historyMode &&
      params.data?.isHistoryVersion &&
      changelogCellStyle(params, 'version')
  })
  if (historyMode) {
    cols.push({
      field: 'complianceYears',
      headerName: t('chargingSite:fseColumnLabels.complianceYears'),
      minWidth: 220,
      sortable: false,
      filter: false,
      valueGetter: (params) => params.data?.complianceYears || [],
      cellRenderer: (params) => {
        const years = params.value || []
        if (!years.length) return ''

        return (
          <>
            {years.map((year) => (
              <StyledChip
                key={`${params.data?.chargingEquipmentId}-${year}`}
                label={year}
                sx={{
                  backgroundColor: '#686666',
                  color: '#fff',
                  fontWeight: '400'
                }}
              />
            ))}
          </>
        )
      },
      cellStyle: (params) =>
        historyMode &&
        params.data?.isHistoryVersion &&
        changelogCellStyle(params, 'complianceYears')
    })
  }

  // Serial Number
  cols.push({
    field: 'serialNumber',
    headerName: t('chargingSite:fseColumnLabels.serialNumber'),
    minWidth: 220,
    cellStyle: (params) =>
      historyMode &&
      params.data?.isHistoryVersion &&
      changelogCellStyle(params, 'serialNumber')
  })

  // Manufacturer
  cols.push({
    field: 'manufacturer',
    headerName: t('chargingSite:fseColumnLabels.manufacturer'),
    minWidth: 320,
    cellStyle: (params) =>
      historyMode &&
      params.data?.isHistoryVersion &&
      changelogCellStyle(params, 'manufacturer')
  })

  // Model
  cols.push({
    field: 'model',
    headerName: t('chargingSite:fseColumnLabels.model'),
    minWidth: 220,
    cellStyle: (params) =>
      historyMode &&
      params.data?.isHistoryVersion &&
      changelogCellStyle(params, 'model')
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
      '',
    cellStyle: (params) =>
      historyMode &&
      params.data?.isHistoryVersion &&
      changelogCellStyle(params, 'levelOfEquipment')
  })
  // ports
  cols.push({
    field: 'ports',
    headerName: t('chargingSite:fseColumnLabels.ports'),
    minWidth: 160,
    sortable: false,
    cellStyle: (params) =>
      historyMode &&
      params.data?.isHistoryVersion &&
      changelogCellStyle(params, 'ports')
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
    cellRendererParams: { disableLink: true },
    cellStyle: (params) =>
      historyMode &&
      params.data?.isHistoryVersion &&
      changelogCellStyle(params, 'intendedUseTypes')
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
      cellRendererParams: { disableLink: true },
      cellStyle: (params) =>
        historyMode &&
        params.data?.isHistoryVersion &&
        changelogCellStyle(params, 'intendedUserTypes')
    })
  }
  // Location fields (only for site view)
  if (showLocationFields) {
    cols.push(
      {
        field: 'latitude',
        sortable: false,
        filter: false,
        headerName: t('chargingSite:fseColumnLabels.latitude'),
        minWidth: 150,
        valueGetter: (params) => params.data?.latitude || '',
        cellStyle: (params) =>
          historyMode &&
          params.data?.isHistoryVersion &&
          changelogCellStyle(params, 'latitude')
      },
      {
        field: 'longitude',
        sortable: false,
        filter: false,
        headerName: t('chargingSite:fseColumnLabels.longitude'),
        minWidth: 150,
        valueGetter: (params) => params.data?.longitude || '',
        cellStyle: (params) =>
          historyMode &&
          params.data?.isHistoryVersion &&
          changelogCellStyle(params, 'longitude')
      }
    )
  }
  // Date columns (only for list view)
  if (showDateColumns) {
    cols.push(
      {
        field: 'createdDate',
        headerName: t('chargingSite:fseColumnLabels.created'),
        minWidth: 150,
        type: 'dateColumn',
        filter: false,
        valueFormatter: dateFormatter
      },
      {
        field: 'updatedDate',
        headerName: t('chargingSite:fseColumnLabels.lastUpdated'),
        minWidth: 150,
        filter: false,
        type: 'dateColumn',
        valueFormatter: dateFormatter
      }
    )
  }

  // Notes (only for site view)
  if (showNotes) {
    cols.push({
      field: 'notes',
      minWidth: 600,
      filter: false,
      headerName: t('chargingSite:fseColumnLabels.notes'),
      cellStyle: (params) =>
        historyMode &&
        params.data?.isHistoryVersion &&
        changelogCellStyle(params, 'notes')
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
    cellRenderer: ChargingSiteStatusRenderer,
    suppressFloatingFilterButton: true,
    filterParams: {
      values: ['Draft', 'Updated', 'Submitted', 'Validated', 'Decommissioned']
    }
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
