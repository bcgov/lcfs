import { suppressKeyboardEvent } from '@/utils/eventHandlers'
import {
  AsyncSuggestionEditor,
  AutocompleteEditor,
  DateEditor,
  HeaderComponent
} from '@/components/BCDataGrid/components'
import { apiRoutes } from '@/constants/routes'
import i18n from '@/i18n'
import { CommonArrayRenderer } from '@/utils/cellRenderers'
import { Typography } from '@mui/material'
import { actions, validation } from '@/components/BCDataGrid/columns'

const cellErrorStyle = (params) => {
  if (params.data.validationMsg && params.data.validationMsg[params.colDef.field]) {
    return { borderColor: 'red' }
  }
  return { borderColor: 'unset' }
}

export const fuelCodeColDefs = (optionsData, errors) => [
  validation,
  actions({
    enableDuplicate: true,
    enableDelete: true
  }),
  {
    field: 'id',
    hide: true
  },
  {
    field: 'prefix',
    headerComponent: HeaderComponent,
    headerName: i18n.t('fuelCode:fuelCodeColLabels.prefix'),
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: {
      values: optionsData?.fuelCodePrefixes?.map((obj) => obj.prefix)
    },
    minWidth: 135,
    valueGetter: (params) => params.data.prefix || 'BCLCF',
    valueSetter: (params) => {
      if (params.newValue !== params.oldValue) {
        params.data.prefix = params.newValue
        params.data.fuelCode = optionsData?.fuelCodePrefixes?.find(
          (obj) => obj.prefix === params.newValue
        )?.nextFuelCode
        params.data.company = undefined
        params.data.fuel = undefined
        params.data.feedstock = undefined
        params.data.feedstockLocation = undefined
        params.data.feedstockTransportMode = undefined
        params.data.finishedFuelTransportMode = undefined
        params.data.formerCompany = undefined
        params.data.contactName = undefined
        params.data.contactEmail = undefined
      }
      return true
    },
    cellRenderer: (params) => {
      const hasError = errors[params.data.id]?.includes('prefix')
      return (
        <div style={{ color: hasError ? 'red' : 'inherit' }}>
          {params.value || 'BCLCF'}
        </div>
      )
    }
  },
  {
    field: 'fuelCode',
    headerComponent: HeaderComponent,
    headerName: i18n.t('fuelCode:fuelCodeColLabels.fuelCode'),
    cellDataType: 'text',
    cellRenderer: (params) => {
      const hasError = errors[params.data.id]?.includes('fuelCode')
      return (
        <div style={{ color: hasError ? 'red' : 'inherit' }}>
          {params.value || (!params.value && <Typography variant="body4">Select</Typography>)}
        </div>
      )
    },
    cellEditor: AsyncSuggestionEditor,
    cellEditorParams: (params) => ({
      queryKey: 'fuel-code-search',
      queryFn: async ({ queryKey, client }) => {
        let path = apiRoutes.fuelCodeSearch
        path +=
          'prefix=' +
          (params.data.prefix || 'BCLCF') +
          '&distinctSearch=true&fuelCode=' +
          queryKey[1]
        const response = await client.get(path)
        return response.data
      },
      optionLabel: 'fuelCodes',
      title: 'fuelCode'
    }),
    suppressKeyboardEvent,
    valueGetter: (params) => {
      if (!params.data.fuelCode) {
        const prefix = params.data.prefix || 'BCLCF'
        return optionsData?.fuelCodePrefixes?.find(
          (obj) => obj.prefix === prefix
        )?.nextFuelCode
      }
      return params.data.fuelCode
    },
    tooltipValueGetter: (p) => 'select the next fuel code version'
  },
  {
    field: 'carbonIntensity',
    headerComponent: HeaderComponent,
    headerName: i18n.t('fuelCode:fuelCodeColLabels.carbonIntensity'),
    cellEditor: 'agNumberCellEditor',
    cellEditorParams: {
      precision: 2,
      showStepperButtons: false
    },
    type: 'numericColumn',
    cellRenderer: (params) => {
      const hasError = errors[params.data.id]?.includes('carbonIntensity')
      return (
        <div style={{ color: hasError ? 'red' : 'inherit' }}>
          {params.value}
        </div>
      )
    }
  },
  {
    field: 'edrms',
    headerComponent: HeaderComponent,
    headerName: i18n.t('fuelCode:fuelCodeColLabels.edrms'),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    cellRenderer: (params) => {
      const hasError = errors[params.data.id]?.includes('edrms')
      return (
        <div style={{ color: hasError ? 'red' : 'inherit' }}>
          {params.value}
        </div>
      )
    }
  },
  {
    field: 'company',
    headerComponent: HeaderComponent,
    headerName: i18n.t('fuelCode:fuelCodeColLabels.company'),
    cellDataType: 'text',
    cellEditor: AsyncSuggestionEditor,
    cellEditorParams: (params) => ({
      queryKey: 'company-name-search',
      queryFn: async ({ queryKey, client }) => {
        let path = apiRoutes.fuelCodeSearch
        path += 'company=' + queryKey[1]
        const response = await client.get(path)
        return response.data
      },
      title: 'company'
    }),
    valueSetter: (params) => {
      params.data.company = params.newValue
      if (params.newValue === '') {
        params.data.contactName = ''
        params.data.contactEmail = ''
      }
      return true
    },
    suppressKeyboardEvent,
    minWidth: 300,
    cellRenderer: (params) => {
      const hasError = errors[params.data.id]?.includes('company')
      return (
        <div style={{ color: hasError ? 'red' : 'inherit' }}>
          {params.value || (!params.value && <Typography variant="body4">Select</Typography>)}
        </div>
      )
    }
  },
  {
    field: 'contactName',
    headerName: i18n.t('fuelCode:fuelCodeColLabels.contactName'),
    cellEditor: AsyncSuggestionEditor,
    cellDataType: 'text',
    cellEditorParams: (params) => ({
      queryKey: 'contact-name-search',
      queryFn: async ({ queryKey, client }) => {
        let path = apiRoutes.fuelCodeSearch
        path += 'company=' + params.data.company + '&contactName=' + queryKey[1]
        const response = await client.get(path)
        return response.data
      },
      title: 'contactName',
      enabled: params.data.company !== ''
    }),
    suppressKeyboardEvent,
    minWidth: 300,
    cellRenderer: (params) => {
      const hasError = errors[params.data.id]?.includes('contactName')
      return (
        <div style={{ color: hasError ? 'red' : 'inherit' }}>
          {params.value || (!params.value && <Typography variant="body4">Select</Typography>)}
        </div>
      )
    }
  },
  {
    field: 'contactEmail',
    headerName: i18n.t('fuelCode:fuelCodeColLabels.contactEmail'),
    cellEditor: AsyncSuggestionEditor,
    cellDataType: 'text',
    cellEditorParams: (params) => ({
      queryKey: 'contact-email-search',
      queryFn: async ({ queryKey, client }) => {
        let path = apiRoutes.fuelCodeSearch
        path +=
          'company=' +
          params.data.company +
          '&contactName=' +
          params.data.contactName +
          '&contactEmail=' +
          queryKey[1]
        const response = await client.get(path)
        return response.data
      },
      title: 'contactEmail',
      enabled: params.data.company !== '' && params.data.contactName !== ''
    }),
    suppressKeyboardEvent,
    minWidth: 300,
    cellRenderer: (params) => {
      const hasError = errors[params.data.id]?.includes('contactEmail')
      return (
        <div style={{ color: hasError ? 'red' : 'inherit' }}>
          {params.value || (!params.value && <Typography variant="body4">Select</Typography>)}
        </div>
      )
    }
  },
  {
    field: 'applicationDate',
    headerName: i18n.t('fuelCode:fuelCodeColLabels.applicationDate'),
    maxWidth: 220,
    minWidth: 200,
    cellRenderer: (params) => {
      const hasError = errors[params.data.id]?.includes('applicationDate')
      return (
        <Typography variant="body4" style={{ color: hasError ? 'red' : 'inherit' }}>
          {params.value ? params.value : 'YYYY-MM-DD'}
        </Typography>
      )
    },
    suppressKeyboardEvent,
    cellEditor: DateEditor
  },
  {
    field: 'approvalDate',
    headerName: i18n.t('fuelCode:fuelCodeColLabels.approvalDate'),
    maxWidth: 220,
    minWidth: 220,
    cellRenderer: (params) => {
      const hasError = errors[params.data.id]?.includes('approvalDate')
      return (
        <Typography variant="body4" style={{ color: hasError ? 'red' : 'inherit' }}>
          {params.value ? params.value : 'YYYY-MM-DD'}
        </Typography>
      )
    },
    suppressKeyboardEvent,
    cellEditor: DateEditor
  },
  {
    field: 'effectiveDate',
    headerName: i18n.t('fuelCode:fuelCodeColLabels.effectiveDate'),
    maxWidth: 220,
    minWidth: 220,
    cellRenderer: (params) => {
      const hasError = errors[params.data.id]?.includes('effectiveDate')
      return (
        <Typography variant="body4" style={{ color: hasError ? 'red' : 'inherit' }}>
          {params.value ? params.value : 'YYYY-MM-DD'}
        </Typography>
      )
    },
    suppressKeyboardEvent,
    cellEditor: DateEditor
  },
  {
    field: 'expirationDate',
    headerName: i18n.t('fuelCode:fuelCodeColLabels.expiryDate'),
    maxWidth: 220,
    minWidth: 220,
    cellRenderer: (params) => {
      const hasError = errors[params.data.id]?.includes('expirationDate')
      return (
        <Typography variant="body4" style={{ color: hasError ? 'red' : 'inherit' }}>
          {params.value ? params.value : 'YYYY-MM-DD'}
        </Typography>
      )
    },
    suppressKeyboardEvent,
    cellEditor: DateEditor
  },
  {
    field: 'fuel',
    headerName: i18n.t('fuelCode:fuelCodeColLabels.fuel'),
    cellEditor: AutocompleteEditor,
    cellRenderer: (params) => {
      const hasError = errors[params.data.id]?.includes('fuel')
      return (
        <div style={{ color: hasError ? 'red' : 'inherit' }}>
          {params.value || (!params.value && <Typography variant="body4">Select</Typography>)}
        </div>
      )
    },
    cellEditorParams: {
      options: optionsData.fuelTypes
        .filter((fuel) => !fuel.fossilDerived)
        .map((obj) => obj.fuelType),
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    },
    suppressKeyboardEvent,
    minWidth: 300
  },
  {
    field: 'feedstock',
    headerName: i18n.t('fuelCode:fuelCodeColLabels.feedstock'),
    cellEditor: AutocompleteEditor,
    suppressKeyboardEvent,
    cellDataType: 'text',
    cellRenderer: (params) => {
      const hasError = errors[params.data.id]?.includes('feedstock')
      return (
        <div style={{ color: hasError ? 'red' : 'inherit' }}>
          {params.value || (!params.value && <Typography variant="body4">Select</Typography>)}
        </div>
      )
    },
    cellEditorParams: {
      noLabel: true,
      options: optionsData.fieldOptions.feedstock,
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: true,
      openOnFocus: true
    },
    minWidth: 300
  },
  {
    field: 'feedstockLocation',
    headerName: i18n.t('fuelCode:fuelCodeColLabels.feedstockLocation'),
    cellEditor: AutocompleteEditor,
    suppressKeyboardEvent,
    cellDataType: 'text',
    cellRenderer: (params) => {
      const hasError = errors[params.data.id]?.includes('feedstockLocation')
      return (
        <div style={{ color: hasError ? 'red' : 'inherit' }}>
          {params.value || (!params.value && <Typography variant="body4">Select</Typography>)}
        </div>
      )
    },
    cellEditorParams: {
      noLabel: true,
      options: optionsData.fieldOptions.feedstockLocation,
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: true,
      openOnFocus: true
    },
    minWidth: 300
  },
  {
    field: 'feedstockMisc',
    headerName: i18n.t('fuelCode:fuelCodeColLabels.misc'),
    cellEditor: AutocompleteEditor,
    suppressKeyboardEvent,
    cellDataType: 'text',
    cellRenderer: (params) => {
      const hasError = errors[params.data.id]?.includes('feedstockMisc')
      return (
        <div style={{ color: hasError ? 'red' : 'inherit' }}>
          {params.value || (!params.value && <Typography variant="body4">Select</Typography>)}
        </div>
      )
    },
    cellEditorParams: {
      noLabel: true,
      options: optionsData.fieldOptions.feedstockMisc,
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: true,
      openOnFocus: true
    },
    minWidth: 495
  },
  {
    field: 'fuelProductionFacilityCity',
    headerName: i18n.t('fuelCode:fuelCodeColLabels.fuelProductionFacilityCity'),
    cellEditor: AutocompleteEditor,
    suppressKeyboardEvent,
    cellDataType: 'text',
    cellRenderer: (params) => {
      const hasError = errors[params.data.id]?.includes('fuelProductionFacilityCity')
      return (
        <div style={{ color: hasError ? 'red' : 'inherit' }}>
          {params.value || (!params.value && <Typography variant="body4">Select</Typography>)}
        </div>
      )
    },
    cellEditorParams: {
      onDynamicUpdate: (val, params) => params.api.stopEditing(),
      noLabel: true,
      options: [
        ...new Map(
          optionsData.fpLocations.map((location) => [
            location.fuelProductionFacilityCity,
            location.fuelProductionFacilityCity
          ])
        ).values()
      ],
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: true,
      openOnFocus: true
    },
    minWidth: 325,
    valueSetter: (params) => {
      params.data.fuelProductionFacilityCity = params.newValue

      const location = optionsData.fpLocations.find(
        (location) => location.fuelProductionFacilityCity === params.newValue
      )

      params.data.fuelProductionFacilityProvinceState =
        location.fuelProductionFacilityProvinceState
      params.data.fuelProductionFacilityCountry =
        location.fuelProductionFacilityCountry

      return true
    }
  },
  {
    field: 'fuelProductionFacilityProvinceState',
    headerName: i18n.t(
      'fuelCode:fuelCodeColLabels.fuelProductionFacilityProvinceState'
    ),
    cellEditor: AutocompleteEditor,
    suppressKeyboardEvent,
    cellDataType: 'text',
    cellRenderer: (params) => {
      const hasError = errors[params.data.id]?.includes('fuelProductionFacilityProvinceState')
      return (
        <div style={{ color: hasError ? 'red' : 'inherit' }}>
          {params.value || (!params.value && <Typography variant="body4">Select</Typography>)}
        </div>
      )
    },
    cellEditorParams: {
      onDynamicUpdate: (val, params) => params.api.stopEditing(),
      noLabel: true,
      options: [
        ...new Map(
          optionsData.fpLocations.map((location) => [
            location.fuelProductionFacilityProvinceState,
            location.fuelProductionFacilityProvinceState
          ])
        ).values()
      ],
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: true,
      openOnFocus: true
    },
    minWidth: 325,
    valueSetter: (params) => {
      params.data.fuelProductionFacilityProvinceState = params.newValue

      const location = optionsData.fpLocations.find(
        (location) =>
          location.fuelProductionFacilityProvinceState === params.newValue
      )
      params.data.fuelProductionFacilityCountry =
        location.fuelProductionFacilityCountry

      return true
    }
  },
  {
    field: 'fuelProductionFacilityCountry',
    headerName: i18n.t(
      'fuelCode:fuelCodeColLabels.fuelProductionFacilityCountry'
    ),
    cellEditor: AutocompleteEditor,
    suppressKeyboardEvent,
    cellDataType: 'text',
    cellRenderer: (params) => {
      const hasError = errors[params.data.id]?.includes('fuelProductionFacilityCountry')
      return (
        <div style={{ color: hasError ? 'red' : 'inherit' }}>
          {params.value || (!params.value && <Typography variant="body4">Select</Typography>)}
        </div>
      )
    },
    cellEditorParams: {
      noLabel: true,
      options: [
        ...new Map(
          optionsData.fpLocations.map((location) => [
            location.fuelProductionFacilityCountry,
            location.fuelProductionFacilityCountry
          ])
        ).values()
      ],
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: true,
      openOnFocus: true
    },
    minWidth: 325
  },
  {
    field: 'facilityNameplateCapacity',
    headerName: i18n.t('fuelCode:fuelCodeColLabels.facilityNameplateCapacity'),
    cellEditor: 'agNumberCellEditor',
    type: 'numericColumn',
    cellEditorParams: {
      precision: 0,
      min: 0,
      showStepperButtons: false
    },
    cellRenderer: (params) => {
      const hasError = errors[params.data.id]?.includes('facilityNameplateCapacity')
      return (
        <div style={{ color: hasError ? 'red' : 'inherit' }}>
          {params.value}
        </div>
      )
    },
    minWidth: 290
  },
  {
    field: 'facilityNameplateCapacityUnit',
    headerName: i18n.t(
      'fuelCode:fuelCodeColLabels.facilityNameplateCapacityUnit'
    ),
    cellEditor: AutocompleteEditor,
    cellRenderer: (params) => {
      const hasError = errors[params.data.id]?.includes('facilityNameplateCapacityUnit')
      return (
        <div style={{ color: hasError ? 'red' : 'inherit' }}>
          {params.value || (!params.value && <Typography variant="body4">Select</Typography>)}
        </div>
      )
    },
    cellEditorParams: {
      options: optionsData.facilityNameplateCapacityUnits,
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    },
    suppressKeyboardEvent,
    minWidth: 300
  },
  {
    field: 'feedstockTransportMode',
    headerName: i18n.t('fuelCode:fuelCodeColLabels.feedstockTransportMode'),
    cellEditor: AutocompleteEditor,
    cellRenderer: (params) => {
      const hasError = errors[params.data.id]?.includes('feedstockTransportMode')
      return (
        <div style={{ color: hasError ? 'red' : 'inherit' }}>
          {params.value ? (
            <CommonArrayRenderer {...params} />
          ) : (
            <Typography variant="body4">Select</Typography>
          )}
        </div>
      )
    },
    cellRendererParams: {
      disableLink: true
    },
    cellEditorParams: {
      options: optionsData.transportModes.map((obj) => obj.transportMode),
      multiple: true,
      openOnFocus: true,
      disableCloseOnSelect: true
    },
    suppressKeyboardEvent,
    minWidth: 325
  },
  {
    field: 'finishedFuelTransportMode',
    headerName: i18n.t('fuelCode:fuelCodeColLabels.finishedFuelTransportMode'),
    cellEditor: AutocompleteEditor,
    cellRenderer: (params) => {
      const hasError = errors[params.data.id]?.includes('finishedFuelTransportMode')
      return (
        <div style={{ color: hasError ? 'red' : 'inherit' }}>
          {params.value ? (
            <CommonArrayRenderer {...params} />
          ) : (
            <Typography variant="body4">Select</Typography>
          )}
        </div>
      )
    },
    cellRendererParams: {
      disableLink: true
    },
    cellEditorParams: {
      options: optionsData.transportModes.map((obj) => obj.transportMode),
      multiple: true,
      openOnFocus: true,
      disableCloseOnSelect: true
    },
    suppressKeyboardEvent,
    minWidth: 325
  },
  {
    field: 'formerCompany',
    headerName: i18n.t('fuelCode:fuelCodeColLabels.formerCompany'),
    cellEditor: AutocompleteEditor,
    suppressKeyboardEvent,
    cellDataType: 'text',
    cellRenderer: (params) => {
      const hasError = errors[params.data.id]?.includes('formerCompany')
      return (
        <div style={{ color: hasError ? 'red' : 'inherit' }}>
          {params.value || (!params.value && <Typography variant="body4">Select</Typography>)}
        </div>
      )
    },
    cellEditorParams: {
      noLabel: true,
      options: optionsData.fieldOptions.formerCompany,
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: true,
      openOnFocus: true
    },
    minWidth: 300
  },
  {
    field: 'notes',
    headerName: i18n.t('fuelCode:fuelCodeColLabels.notes'),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    cellRenderer: (params) => {
      const hasError = errors[params.data.id]?.includes('notes')
      return (
        <div style={{ color: hasError ? 'red' : 'inherit' }}>
          {params.value}
        </div>
      )
    },
    minWidth: 600
  }
]

export const defaultColDef = {
  editable: true,
  resizable: true,
  filter: true,
  floatingFilter: false,
  sortable: false,
  singleClickEdit: true,
  cellStyle: cellErrorStyle
}