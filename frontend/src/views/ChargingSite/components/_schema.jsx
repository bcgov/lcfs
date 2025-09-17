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
  CommonArrayRenderer,
  MultiSelectRenderer
} from '@/utils/grid/cellRenderers'
import { StandardCellWarningAndErrors } from '@/utils/grid/errorRenderers'
import { apiRoutes } from '@/constants/routes'
import { numberFormatter } from '@/utils/formatters.js'
import { useChargingEquipmentStatuses } from '@/hooks/useChargingSite'

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
  intendedUsers,
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
      headerName: i18n.t('report:chargingSites.columnLabels.chargingSiteId'),
      cellEditor: 'agTextCellEditor',
      cellDataType: 'text',
      hide: true
    },
    {
      field: 'siteName',
      headerComponent: RequiredHeader,
      headerName: i18n.t('report:chargingSites.columnLabels.siteName'),
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
      headerName: i18n.t('report:chargingSites.columnLabels.streetAddress'),
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
      headerName: i18n.t('report:chargingSites.columnLabels.city'),
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
      headerName: i18n.t('report:chargingSites.columnLabels.postalCode'),
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
      headerName: i18n.t('report:chargingSites.columnLabels.latitude'),
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
      headerName: i18n.t('report:chargingSites.columnLabels.longitude'),
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
      field: 'intendedUsers',
      headerComponent: RequiredHeader,
      headerName: i18n.t('report:chargingSites.columnLabels.intendedUserTypes'),
      valueGetter: (params) =>
        params.data?.intendedUsers?.map((i) => ({
          ...i,
          label: i.typeName,
          value: i.endUserTypeId
        })),
      valueSetter: (params) => {
        const newValue = params.newValue || []
        params.data.intendedUsers = newValue.map((i) => ({
          endUserTypeId: i.endUserTypeId,
          typeName: i.typeName
        }))
        return true
      },
      cellEditor: AutocompleteCellEditor,
      cellEditorParams: {
        options:
          intendedUsers.map((obj) => ({
            ...obj,
            label: obj.typeName,
            value: obj.endUserTypeId
          })) || [],
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
      field: 'notes',
      headerName: i18n.t('report:chargingSites.columnLabels.notes'),
      cellEditor: 'agTextCellEditor',
      minWidth: 500,
      editable: true
    }
  ]
}

export const chargingEquipmentColDefs = (t, currentUser) => {
  return [
    {
      headerName: '',
      field: 'select',
      checkboxSelection: true,
      headerCheckboxSelection: true,
      width: 50,
      pinned: 'left',
      lockPinned: true,
      filter: false,
      sortable: false
    },
    {
      field: 'status',
      minWidth: 175,
      filter: true,
      headerName: t('fseColumnLabels.status'),
      valueGetter: (params) => {
        return params.data?.status?.status || ''
      },
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
      valueGetter: (params) => params.data?.chargingSite?.siteName || ''
    },
    {
      field: 'registrationNumber',
      sortable: false,
      minWidth: 160,
      headerName: t('fseColumnLabels.registrationNumber')
    },
    {
      field: 'version',
      headerName: t('fseColumnLabels.version')
    },
    {
      field: 'allocatingOrganization',
      minWidth: 250,
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
  editable: true,
  resizable: true,
  filter: false,
  floatingFilter: false,
  sortable: false,
  singleClickEdit: true
}
