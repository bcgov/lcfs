import { suppressKeyboardEvent } from '@/utils/grid/eventHandlers'
import {
  AsyncSuggestionEditor,
  AutocompleteCellEditor,
  DateEditor,
  NumberEditor,
  RequiredHeader
} from '@/components/BCDataGrid/components'
import { apiRoutes } from '@/constants/routes'
import i18n from '@/i18n'
import { CommonArrayRenderer } from '@/utils/grid/cellRenderers'
import BCTypography from '@/components/BCTypography'
import { actions, validation } from '@/components/BCDataGrid/columns'
import { numberFormatter } from '@/utils/formatters'

const cellErrorStyle = (params) => {
  if (
    params.data.validationMsg &&
    params.data.validationMsg[params.colDef.field]
  ) {
    return { borderColor: 'red' }
  }
  return { borderColor: 'unset' }
}

const createCellRenderer = (field, customRenderer = null) => {
  const CellRenderer = (params) => {
    const hasError =
      params.data.id && params.context.errors[params.data.id]?.includes(field)
    const content = customRenderer
      ? customRenderer(params)
      : params.value ||
        (!params.value && <BCTypography variant="body4">Select</BCTypography>)
    return <div style={{ color: hasError ? 'red' : 'inherit' }}>{content}</div>
  }

  CellRenderer.displayName = `CellRenderer_${field}`

  return CellRenderer
}

export const fuelCodeColDefs = (optionsData, errors, isCreate, canEdit) => [
  validation,
  actions({
    enableDuplicate: isCreate,
    enableDelete: canEdit,
    hide: !canEdit
  }),
  {
    field: 'id',
    hide: true
  },
  {
    field: 'fuelCodeId',
    hide: true
  },
  {
    field: 'prefixId',
    hide: true
  },
  {
    field: 'prefix',
    editable: canEdit,
    headerComponent: canEdit ? RequiredHeader : undefined,
    headerName: i18n.t('fuelCode:fuelCodeColLabels.prefix'),
    cellEditor: AutocompleteCellEditor,
    cellEditorParams: (params) => ({
      options: optionsData?.fuelCodePrefixes
        ?.filter((obj) => obj.prefix)
        .map((obj) => obj.prefix),
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    }),
    suppressKeyboardEvent,
    minWidth: 135,
    valueGetter: (params) => {
      if (params.data?.fuelCodePrefix?.prefix) {
        return params.data.fuelCodePrefix.prefix
      } else if (params.data.prefixId) {
        const selectedOption = optionsData?.fuelCodePrefixes?.find(
          (obj) => obj.fuelCodePrefixId === params.data.prefixId
        )
        return selectedOption.prefix
      }
      const selectedOption = optionsData?.fuelCodePrefixes?.find(
        (obj) => obj.prefix === params.data.prefix
      )
      if (selectedOption) {
        params.data.prefixId = selectedOption.fuelCodePrefixId
      }
      return params.data.prefix
    },
    valueSetter: (params) => {
      if (params.newValue !== params.oldValue) {
        const selectedPrefix = optionsData?.fuelCodePrefixes?.find(
          (obj) => obj.prefix === params.newValue
        )
        params.data.fuelTypeId = selectedPrefix.fuelCodePrefixId

        params.data.fuelCode = optionsData?.fuelCodePrefixes?.find(
          (obj) => obj.prefix === params.newValue
        )?.nextFuelCode
        params.data.company = undefined
        params.data.fuel = undefined
        params.data.feedstock = undefined
        params.data.feedstockLocation = undefined
        params.data.feedstockFuelTransportMode = []
        params.data.finishedFuelTransportMode = []
        params.data.formerCompany = undefined
        params.data.contactName = undefined
        params.data.contactEmail = undefined
      }
      return true
    },
    cellRenderer: createCellRenderer('prefix', (params) => params.value)
  },
  {
    field: 'fuelSuffix',
    editable: canEdit,
    headerComponent: canEdit ? RequiredHeader : undefined,
    headerName: i18n.t('fuelCode:fuelCodeColLabels.fuelCode'),
    cellDataType: 'text',
    cellRenderer: createCellRenderer('fuelSuffix'),
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
        return response.data?.fuelCodes || []
      },
      optionLabel: 'fuelCodes',
      title: 'fuelCode'
    }),
    suppressKeyboardEvent,
    valueGetter: (params) => {
      if (!params.data.fuelSuffix) {
        const prefix = params.data.prefix || 'BCLCF'
        return optionsData?.fuelCodePrefixes?.find(
          (obj) => obj.prefix === prefix
        )?.nextFuelCode
      }
      return params.data.fuelSuffix
    },
    tooltipValueGetter: (p) => 'select the next fuel code version'
  },
  {
    field: 'carbonIntensity',
    editable: canEdit,
    headerComponent: canEdit ? RequiredHeader : undefined,
    headerName: i18n.t('fuelCode:fuelCodeColLabels.carbonIntensity'),
    cellEditor: 'agNumberCellEditor',
    cellEditorParams: {
      precision: 2,
      showStepperButtons: false
    },
    type: 'leftAligned'
  },
  {
    field: 'edrms',
    editable: canEdit,
    headerComponent: canEdit ? RequiredHeader : undefined,
    headerName: i18n.t('fuelCode:fuelCodeColLabels.edrms'),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text'
  },
  {
    field: 'company',
    editable: canEdit,
    headerComponent: canEdit ? RequiredHeader : undefined,
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
      title: 'company',
      api: params.api
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
    cellRenderer: createCellRenderer('company')
  },
  {
    field: 'contactName',
    editable: canEdit,
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
    cellRenderer: createCellRenderer('contactName')
  },
  {
    field: 'contactEmail',
    editable: canEdit,
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
    cellRenderer: createCellRenderer('contactEmail')
  },
  {
    field: 'applicationDate',
    editable: canEdit,
    headerComponent: canEdit ? RequiredHeader : undefined,
    headerName: i18n.t('fuelCode:fuelCodeColLabels.applicationDate'),
    maxWidth: 220,
    minWidth: 200,
    cellRenderer: createCellRenderer('applicationDate', (params) => (
      <BCTypography variant="body4">
        {params.value ? params.value : 'YYYY-MM-DD'}
      </BCTypography>
    )),
    suppressKeyboardEvent,
    cellEditor: DateEditor
  },
  {
    field: 'approvalDate',
    editable: canEdit,
    headerComponent: canEdit ? RequiredHeader : undefined,
    headerName: i18n.t('fuelCode:fuelCodeColLabels.approvalDate'),
    maxWidth: 220,
    minWidth: 220,
    cellRenderer: createCellRenderer('approvalDate', (params) => (
      <BCTypography variant="body4">
        {params.value ? params.value : 'YYYY-MM-DD'}
      </BCTypography>
    )),

    suppressKeyboardEvent,
    cellEditor: DateEditor
  },
  {
    field: 'effectiveDate',
    editable: canEdit,
    headerComponent: canEdit ? RequiredHeader : undefined,
    headerName: i18n.t('fuelCode:fuelCodeColLabels.effectiveDate'),
    maxWidth: 220,
    minWidth: 220,
    cellRenderer: createCellRenderer('effectiveDate', (params) => (
      <BCTypography variant="body4">
        {params.value ? params.value : 'YYYY-MM-DD'}
      </BCTypography>
    )),
    suppressKeyboardEvent,
    cellEditor: DateEditor
  },
  {
    field: 'expirationDate',
    editable: canEdit,
    headerComponent: canEdit ? RequiredHeader : undefined,
    headerName: i18n.t('fuelCode:fuelCodeColLabels.expirationDate'),
    maxWidth: 220,
    minWidth: 220,
    cellRenderer: createCellRenderer('expirationDate', (params) => (
      <BCTypography variant="body4">
        {params.value ? params.value : 'YYYY-MM-DD'}
      </BCTypography>
    )),
    suppressKeyboardEvent,
    cellEditor: DateEditor
  },
  {
    field: 'fuelType',
    editable: canEdit,
    headerComponent: canEdit ? RequiredHeader : undefined,
    headerName: i18n.t('fuelCode:fuelCodeColLabels.fuelType'),
    cellEditor: AutocompleteCellEditor,
    cellRenderer: createCellRenderer('fuelType'),
    valueGetter: (params) => {
      if (params.data?.fuelCodeType?.fuelType) {
        return params.data.fuelCodeType.fuelType
      } else if (params.data.fuelTypeId) {
        const selectedOption = optionsData?.fuelTypes?.find(
          (obj) => obj.fuelTypeId === params.data.fuelTypeId
        )
        return selectedOption.fuelType
      }
      const selectedOption = optionsData?.fuelTypes?.find(
        (obj) => obj.fuelType === params.data.fuel
      )
      if (selectedOption) {
        params.data.fuelTypeId = selectedOption.fuelTypeId
      }
      return params.data.fuel
    },
    valueSetter: (params) => {
      if (params.newValue) {
        const selectedFuelType = optionsData?.fuelTypes?.find(
          (obj) => obj.fuelType === params.newValue
        )
        params.data.fuelTypeId = selectedFuelType.fuelTypeId
      }
    },
    cellEditorParams: {
      options: optionsData?.fuelTypes
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
    editable: canEdit,
    headerComponent: canEdit ? RequiredHeader : undefined,
    headerName: i18n.t('fuelCode:fuelCodeColLabels.feedstock'),
    cellEditor: AutocompleteCellEditor,
    suppressKeyboardEvent,
    cellDataType: 'text',
    cellRenderer: createCellRenderer('feedstock'),
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
    editable: canEdit,
    headerComponent: canEdit ? RequiredHeader : undefined,
    headerName: i18n.t('fuelCode:fuelCodeColLabels.feedstockLocation'),
    cellEditor: AutocompleteCellEditor,
    suppressKeyboardEvent,
    cellDataType: 'text',
    cellRenderer: createCellRenderer('feedstockLocation'),
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
    editable: canEdit,
    headerName: i18n.t('fuelCode:fuelCodeColLabels.misc'),
    cellEditor: AutocompleteCellEditor,
    suppressKeyboardEvent,
    cellDataType: 'text',
    cellRenderer: createCellRenderer('feedstockMisc'),
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
    editable: canEdit,
    headerComponent: canEdit ? RequiredHeader : undefined,
    headerName: i18n.t('fuelCode:fuelCodeColLabels.fuelProductionFacilityCity'),
    cellEditor: AutocompleteCellEditor,
    suppressKeyboardEvent,
    cellDataType: 'text',
    cellRenderer: createCellRenderer('fuelProductionFacilityCity'),
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
        location?.fuelProductionFacilityProvinceState
      params.data.fuelProductionFacilityCountry =
        location?.fuelProductionFacilityCountry

      return true
    }
  },
  {
    field: 'fuelProductionFacilityProvinceState',
    editable: canEdit,
    headerComponent: canEdit ? RequiredHeader : undefined,
    headerName: i18n.t(
      'fuelCode:fuelCodeColLabels.fuelProductionFacilityProvinceState'
    ),
    cellEditor: AutocompleteCellEditor,
    suppressKeyboardEvent,
    cellDataType: 'text',
    cellRenderer: createCellRenderer('fuelProductionFacilityProvinceState'),
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
        location?.fuelProductionFacilityCountry

      return true
    }
  },
  {
    field: 'fuelProductionFacilityCountry',
    editable: canEdit,
    headerComponent: canEdit ? RequiredHeader : undefined,
    headerName: i18n.t(
      'fuelCode:fuelCodeColLabels.fuelProductionFacilityCountry'
    ),
    cellEditor: AutocompleteCellEditor,
    suppressKeyboardEvent,
    cellDataType: 'text',
    cellRenderer: createCellRenderer('fuelProductionFacilityCountry'),
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
    editable: canEdit,
    headerName: i18n.t('fuelCode:fuelCodeColLabels.facilityNameplateCapacity'),
    valueFormatter: numberFormatter,
    cellEditor: NumberEditor,
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
    editable: canEdit,
    headerName: i18n.t(
      'fuelCode:fuelCodeColLabels.facilityNameplateCapacityUnit'
    ),
    cellEditor: AutocompleteCellEditor,
    cellRenderer: createCellRenderer('facilityNameplateCapacityUnit'),
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
    field: 'feedstockFuelTransportMode',
    editable: canEdit,
    headerName: i18n.t('fuelCode:fuelCodeColLabels.feedstockFuelTransportMode'),
    cellEditor: AutocompleteCellEditor,
    cellRenderer: createCellRenderer('feedstockFuelTransportMode', (params) =>
      params.value && params.value.length > 0 ? (
        <CommonArrayRenderer {...params} />
      ) : (
        <BCTypography variant="body4">Select</BCTypography>
      )
    ),
    cellRendererParams: {
      disableLink: true,
      marginTop: '0.7rem'
    },
    cellEditorParams: {
      options: optionsData?.transportModes.map((obj) => obj.transportMode),
      multiple: true,
      openOnFocus: true,
      disableCloseOnSelect: true
    },
    suppressKeyboardEvent,
    minWidth: 325
  },
  {
    field: 'finishedFuelTransportMode',
    editable: canEdit,
    headerName: i18n.t('fuelCode:fuelCodeColLabels.finishedFuelTransportMode'),
    cellEditor: AutocompleteCellEditor,
    cellRenderer: createCellRenderer('finishedFuelTransportMode', (params) =>
      params.value && params.value.length > 0 ? (
        <CommonArrayRenderer {...params} />
      ) : (
        <BCTypography variant="body4">Select</BCTypography>
      )
    ),
    cellRendererParams: {
      disableLink: true,
      marginTop: '0.7rem'
    },
    cellEditorParams: {
      options: optionsData?.transportModes.map((obj) => obj.transportMode),
      multiple: true,
      openOnFocus: true,
      disableCloseOnSelect: true
    },
    suppressKeyboardEvent,
    minWidth: 325
  },
  {
    field: 'formerCompany',
    editable: canEdit,
    headerName: i18n.t('fuelCode:fuelCodeColLabels.formerCompany'),
    cellEditor: AutocompleteCellEditor,
    suppressKeyboardEvent,
    cellDataType: 'text',
    cellRenderer: createCellRenderer('formerCompany'),
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
    editable: canEdit,
    headerName: i18n.t('fuelCode:fuelCodeColLabels.notes'),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    minWidth: 600
  }
]

export const defaultColDef = {
  editable: false,
  resizable: true,
  filter: false,
  floatingFilter: false,
  sortable: false,
  singleClickEdit: true,
  cellStyle: cellErrorStyle
}
