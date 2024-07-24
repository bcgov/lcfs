import { actions, validation } from '@/components/BCDataGrid/columns'
import {
  AsyncSuggestionEditor,
  AutocompleteEditor,
  DateEditor,
  HeaderComponent
} from '@/components/BCDataGrid/components'
import { apiRoutes } from '@/constants/routes'
import { CommonArrayRenderer } from '@/utils/cellRenderers'
import { suppressKeyboardEvent } from '@/utils/eventHandlers'
import { Typography } from '@mui/material'
import * as yup from 'yup'
import i18n from '@/i18n'

// TODO: remove this. we are moving to serverside validation. make sure there are no components that use this
export const fuelCodeSchema = (optionsData) =>
  yup.object().shape({
    prefix: yup
      .string()
      .oneOf(
        optionsData.fuelCodePrefixes.map((obj) => obj.prefix),
        i18n.t('fuelCode:validateMsg.prefix')
      )
      .required(
        i18n.t('fuelCode:validateMsg.isRequired', {
          field: i18n.t('fuelCode:fuelCodeColLabels.prefix')
        })
      ),
    fuelCode: yup.number().required(
      i18n.t('fuelCode:validateMsg.isRequired', {
        field: i18n.t('fuelCode:fuelCodeColLabels.fuelCode')
      })
    ),
    company: yup.string().required(
      i18n.t('fuelCode:validateMsg.isRequired', {
        field: i18n.t('fuelCode:fuelCodeColLabels.company')
      })
    ),
    carbonIntensity: yup.number().required(
      i18n.t('fuelCode:validateMsg.isRequired', {
        field: i18n.t('fuelCode:fuelCodeColLabels.carbonIntensity')
      })
    ),
    edrms: yup.string().required(
      i18n.t('fuelCode:validateMsg.isRequired', {
        field: i18n.t('fuelCode:fuelCodeColLabels.edrms')
      })
    ),
    applicationDate: yup.date().required(
      i18n.t('fuelCode:validateMsg.isRequired', {
        field: i18n.t('fuelCode:fuelCodeColLabels.applicationDate')
      })
    ),
    fuel: yup
      .string()
      .oneOf(
        optionsData.fuelTypes
          .filter((fuel) => !fuel.fossilDerived)
          .map((obj) => obj.fuelType),
        i18n.t('fuelCode:validateMsg.fuel')
      )
      .required(
        i18n.t('fuelCode:validateMsg.isRequired', {
          field: i18n.t('fuelCode:fuelCodeColLabels.fuel')
        })
      ),
    feedstock: yup.string().required(
      i18n.t('fuelCode:validateMsg.isRequired', {
        field: i18n.t('fuelCode:fuelCodeColLabels.feedstock')
      })
    ),
    feedstockLocation: yup.string().required(
      i18n.t('fuelCode:validateMsg.isRequired', {
        field: i18n.t('fuelCode:fuelCodeColLabels.feedstockLocation')
      })
    ),
    fuelProductionFacilityCity: yup.string().required(
      i18n.t('fuelCode:validateMsg.isRequired', {
        field: i18n.t('fuelCode:fuelCodeColLabels.fuelProductionFacilityCity')
      })
    ),
    fuelProductionFacilityProvinceState: yup.string().required(
      i18n.t('fuelCode:validateMsg.isRequired', {
        field: i18n.t(
          'fuelCode:fuelCodeColLabels.fuelProductionFacilityProvinceState'
        )
      })
    ),
    fuelProductionFacilityCountry: yup.string().required(
      i18n.t('fuelCode:validateMsg.isRequired', {
        field: i18n.t(
          'fuelCode:fuelCodeColLabels.fuelProductionFacilityCountry'
        )
      })
    )
  })

const cellErrorStyle = (params, errors) => {
  if (
    errors[params.data.id] &&
    errors[params.data.id].includes(params.colDef.field)
  ) {
    return {
      borderColor: 'red'
    }
  } else {
    return {
      borderColor: 'unset'
    }
  }
}

export const fuelCodeColDefs = (optionsData, errors) => [
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
    field: 'prefix',
    headerComponent: HeaderComponent,
    headerName: i18n.t('fuelCode:fuelCodeColLabels.prefix'),
    cellEditor: AutocompleteEditor,
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>),
    cellEditorParams: {
      options: optionsData?.fuelCodePrefixes?.map((obj) => obj.prefix),
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    },
    cellStyle: (params) => cellErrorStyle(params, errors),
    suppressKeyboardEvent,
    minWidth: 135
    // valueGetter: (params) => params.data.prefix || 'BCLCF'
  },
  {
    field: 'fuelCode',
    headerComponent: HeaderComponent,
    headerName: i18n.t('fuelCode:fuelCodeColLabels.fuelCode'),
    cellDataType: 'text',
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>),
    cellStyle: (params) => cellErrorStyle(params, errors),
    cellEditor: AsyncSuggestionEditor,
    cellEditorParams: (params) => ({
      // TODO: move these react query params out of here.
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
    // valueGetter: (params) => {
    //   if (!params.data.fuelCode) {
    //     const prefix = params.data.prefix || 'BCLCF'
    //     return optionsData?.fuelCodePrefixes?.find(
    //       (obj) => obj.prefix === prefix
    //     )?.nextFuelCode
    //   }
    //   return params.data.fuelCode
    // },
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
    cellStyle: (params) => cellErrorStyle(params, errors),
    type: 'numericColumn'
  },
  {
    field: 'edrms',
    headerComponent: HeaderComponent,
    headerName: i18n.t('fuelCode:fuelCodeColLabels.edrms'),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    cellStyle: (params) => cellErrorStyle(params, errors)
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
    cellStyle: (params) => cellErrorStyle(params, errors),
    valueSetter: (params) => {
      params.data.company = params.newValue
      if (params.newValue === '') {
        params.data.contactName = ''
        params.data.contactEmail = ''
      }
      return true
    },
    suppressKeyboardEvent,
    minWidth: 300
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
    minWidth: 300
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
    minWidth: 300
  },

  {
    field: 'applicationDate',
    headerName: i18n.t('fuelCode:fuelCodeColLabels.applicationDate'),
    maxWidth: 220,
    minWidth: 220,
    cellRenderer: (params) => (
      <Typography variant="body4">
        {params.value ? params.value : 'YYYY-MM-DD'}
      </Typography>
    ),
    suppressKeyboardEvent,
    cellEditor: DateEditor,
    cellStyle: (params) => cellErrorStyle(params, errors)
  },
  {
    field: 'approvalDate',
    headerName: i18n.t('fuelCode:fuelCodeColLabels.approvalDate'),
    maxWidth: 220,
    minWidth: 220,
    cellRenderer: (params) => (
      <Typography variant="body4">
        {params.value ? params.value : 'YYYY-MM-DD'}
      </Typography>
    ),
    suppressKeyboardEvent,
    cellEditor: DateEditor
  },
  {
    field: 'effectiveDate',
    headerName: i18n.t('fuelCode:fuelCodeColLabels.effectiveDate'),
    maxWidth: 220,
    minWidth: 220,
    cellRenderer: (params) => (
      <Typography variant="body4">
        {params.value ? params.value : 'YYYY-MM-DD'}
      </Typography>
    ),
    suppressKeyboardEvent,
    cellEditor: DateEditor
  },
  {
    field: 'expirationDate',
    headerName: i18n.t('fuelCode:fuelCodeColLabels.expiryDate'),
    maxWidth: 220,
    minWidth: 220,
    cellRenderer: (params) => (
      <Typography variant="body4">
        {params.value ? params.value : 'YYYY-MM-DD'}
      </Typography>
    ),
    suppressKeyboardEvent,
    cellEditor: DateEditor
  },
  {
    field: 'fuel',
    headerName: i18n.t('fuelCode:fuelCodeColLabels.fuel'),
    cellEditor: AutocompleteEditor,
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>),
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
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>),
    cellEditorParams: {
      noLabel: true,
      options: optionsData.fieldOptions.feedstock,
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: true,
      openOnFocus: true
    },
    cellStyle: (params) => cellErrorStyle(params, errors),
    minWidth: 300
  },
  {
    field: 'feedstockLocation',
    headerName: i18n.t('fuelCode:fuelCodeColLabels.feedstockLocation'),
    cellEditor: AutocompleteEditor,
    suppressKeyboardEvent,
    cellDataType: 'text',
    cellStyle: (params) => cellErrorStyle(params, errors),
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>),
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
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>),
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
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>),
    cellStyle: (params) => cellErrorStyle(params, errors),
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
    minWidth: 325
  },
  {
    field: 'fuelProductionFacilityProvinceState',
    headerName: i18n.t(
      'fuelCode:fuelCodeColLabels.fuelProductionFacilityProvinceState'
    ),
    cellEditor: AutocompleteEditor,
    suppressKeyboardEvent,
    cellDataType: 'text',
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>),
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
    cellStyle: (params) => cellErrorStyle(params, errors),
    minWidth: 325
  },
  {
    field: 'fuelProductionFacilityCountry',
    headerName: i18n.t(
      'fuelCode:fuelCodeColLabels.fuelProductionFacilityCountry'
    ),
    cellEditor: AutocompleteEditor,
    suppressKeyboardEvent,
    cellDataType: 'text',
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>),
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
    cellStyle: (params) => cellErrorStyle(params, errors),
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
    minWidth: 290
  },
  {
    field: 'facilityNameplateCapacityUnit',
    headerName: i18n.t(
      'fuelCode:fuelCodeColLabels.facilityNameplateCapacityUnit'
    ),
    cellEditor: AutocompleteEditor,
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>),
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
    cellRenderer: (params) =>
      params.value ? (
        <CommonArrayRenderer {...params} />
      ) : (
        <Typography variant="body4">Select</Typography>
      ),
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
    cellRenderer: (params) =>
      params.value ? (
        <CommonArrayRenderer {...params} />
      ) : (
        <Typography variant="body4">Select</Typography>
      ),
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
    minWidth: 600
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
