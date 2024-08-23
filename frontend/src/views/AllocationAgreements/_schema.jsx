import { suppressKeyboardEvent } from '@/utils/eventHandlers'
import { Typography } from '@mui/material'
import {
  AutocompleteEditor,
  HeaderComponent,
  AsyncSuggestionEditor,
} from '@/components/BCDataGrid/components'
import i18n from '@/i18n'
import { actions, validation } from '@/components/BCDataGrid/columns'

export const PROVISION_APPROVED_FUEL_CODE = 'Approved fuel code - Section 6 (5) (c)'

const cellErrorStyle = (params, errors) => {
  let style = {}
  if (
    errors[params.data.id] &&
    errors[params.data.id].includes(params.colDef.field)
  ) {
    style = { ...style, borderColor: 'red' }
  } else {
    style = { ...style, borderColor: 'unset' }
  }
  if (
    params.colDef.editable ||
    (typeof params.colDef.editable === 'function' &&
      params.colDef.editable(params))
  ) {
    style = { ...style, backgroundColor: '#fff' }
  } else {
    style = {
      ...style,
      backgroundColor: '#f2f2f2',
      border: '0.5px solid #adb5bd'
    }
  }
  return style
}

export const allocationAgreementColDefs = (optionsData, errors) => [
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
    headerName: i18n.t('allocationAgreement:allocationAgreementColLabels.complianceReportId'),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    hide: true
  },
  {
    field: 'allocationAgreementId',
    headerName: i18n.t('allocationAgreement:allocationAgreementColLabels.allocationAgreementId'),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    hide: true
  },
  {
    field: 'allocationTransactionType',
    headerComponent: HeaderComponent,
    headerName: i18n.t('allocationAgreement:allocationAgreementColLabels.transaction'),
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: {
      values: ['Purchased', 'Sold']
    },
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>),
    cellStyle: (params) => cellErrorStyle(params, errors),
    suppressKeyboardEvent,
    minWidth: 120,
    editable: true,
    tooltipValueGetter: (p) => 'Select whether the fuel was purchased or sold under the allocation agreement'
  },
  {
    field: 'transactionPartner',
    headerComponent: HeaderComponent,
    headerName: i18n.t('allocationAgreement:allocationAgreementColLabels.transactionPartner'),
    cellEditor: AsyncSuggestionEditor,
    // cellEditorParams: (params) => ({
    //   queryKey: 'trading-partner-name-search',
    //   queryFn: async ({ queryKey, client }) => {
    //     let path = apiRoutes.allocationAgreementSearch
    //     path += 'trading_partner=' + queryKey[1]
    //     const response = await client.get(path)
    //     return response.data
    //   },
    //   title: 'transactionPartner',
    //   api: params.api,
    // }),
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Enter</Typography>),
    cellStyle: (params) => cellErrorStyle(params, errors),
    suppressKeyboardEvent,
    minWidth: 310,
    editable: true,
    // valueSetter: (params) => {
    //   if (params.newValue) {
    //     const company = optionsData?.companies?.find(
    //       (c) => c.name === params.newValue
    //     )
    //     if (company) {
    //       params.data.transactionPartner = params.newValue
    //       params.data.postalAddress = company.address
    //       params.data.transactionPartnerEmail = company.email
    //       params.data.transactionPartnerPhone = company.phone
    //     } else {
    //       params.data.transactionPartner = params.newValue
    //       params.data.postalAddress = ''
    //       params.data.transactionPartnerEmail = ''
    //       params.data.transactionPartnerPhone = ''
    //     }
    //   }
    //   return true
    // },
    tooltipValueGetter: (p) => 'Enter or select the legal name of the trading partner'
  },
  {
    field: 'postalAddress',
    headerName: i18n.t('allocationAgreement:allocationAgreementColLabels.postalAddress'),
    cellEditor: 'agTextCellEditor',
    cellStyle: (params) => cellErrorStyle(params, errors),
    editable: true,
    minWidth: 220
  },
  {
    field: 'transactionPartnerEmail',
    headerName: i18n.t('allocationAgreement:allocationAgreementColLabels.transactionPartnerEmail'),
    cellEditor: 'agTextCellEditor',
    cellStyle: (params) => cellErrorStyle(params, errors),
    editable: true,
    minWidth: 150
  },
  {
    field: 'transactionPartnerPhone',
    headerName: i18n.t('allocationAgreement:allocationAgreementColLabels.transactionPartnerPhone'),
    cellEditor: 'agTextCellEditor',
    cellStyle: (params) => cellErrorStyle(params, errors),
    editable: true,
    minWidth: 120
  },
  {
    field: 'fuelType',
    headerComponent: HeaderComponent,
    headerName: i18n.t('allocationAgreement:allocationAgreementColLabels.fuelType'),
    cellEditor: AutocompleteEditor,
    cellEditorParams: {
      options: optionsData?.fuelTypes?.map((obj) => obj.fuelType).sort(),
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    },
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>),
    cellStyle: (params) => cellErrorStyle(params, errors),
    suppressKeyboardEvent,
    minWidth: 200,
    editable: true,
    valueGetter: (params) => params.data.fuelType,
    valueSetter: (params) => {
      if (params.newValue) {
        const fuelType = optionsData?.fuelTypes?.find(
          (obj) => obj.fuelType === params.newValue
        )
        params.data.fuelType = params.newValue
        params.data.fuelTypeId = fuelType?.fuelTypeId
        params.data.fuelTypeOther = undefined
        params.data.fuelCategory = fuelType.fuelCategories?.[0]?.category ?? null;
        params.data.units = fuelType?.units
      }
      return true
    },
    tooltipValueGetter: (p) => 'Select the fuel type from the list'
  },
  {
    field: 'fuelTypeOther',
    headerName: i18n.t('allocationAgreement:allocationAgreementColLabels.fuelTypeOther'),
    cellStyle: (params) => {
      const style = cellErrorStyle(params, errors)
      const conditionalStyle = params.data.fuelType === 'Other'
        ? { backgroundColor: '#fff', borderColor: 'unset' }
        : { backgroundColor: '#f2f2f2' }
      return { ...style, ...conditionalStyle }
    },
    editable: (params) => params.data.fuelType === 'Other',
    minWidth: 150
  },
  {
    field: 'fuelCategory',
    headerName: i18n.t('allocationAgreement:allocationAgreementColLabels.fuelCategory'),
    cellEditor: AutocompleteEditor,
    cellEditorParams: (params) => ({
      options: optionsData?.fuelTypes
        ?.find((obj) => params.data.fuelType === obj.fuelType)
        ?.fuelCategories.map((item) => item.category) || [],
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    }),
    suppressKeyboardEvent,
    minWidth: 150,
    editable: (params) => optionsData?.fuelTypes
      ?.find((obj) => params.data.fuelType === obj.fuelType)
      ?.fuelCategories.length > 1 && params.data.fuelType != null,
  },
  {
    field: 'provisionOfTheAct',
    headerComponent: HeaderComponent,
    headerName: i18n.t('allocationAgreement:allocationAgreementColLabels.provisionOfTheAct'),
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: {
      values: optionsData?.provisionsOfTheAct?.map((obj) => obj.name).sort(),
    },
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>),
    cellStyle: (params) => cellErrorStyle(params, errors),
    suppressKeyboardEvent,
    minWidth: 300,
    editable: true,
    tooltipValueGetter: (p) => 'Select the method for determining carbon intensity'
  },
  {
    field: 'fuelCode',
    headerName: i18n.t('allocationAgreement:allocationAgreementColLabels.fuelCode'),
    cellEditor: AutocompleteEditor,
    cellEditorParams: (params) => ({
      options: optionsData?.fuelTypes
        ?.find((obj) => params.data.fuelType === obj.fuelType)
        ?.fuelCodes.map((item) => item.fuelCode) || [],
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    }),
    cellStyle: (params) => {
      const style = cellErrorStyle(params, errors)
      const conditionalStyle = params.data.provisionOfTheAct === PROVISION_APPROVED_FUEL_CODE
        ? { backgroundColor: '#fff', borderColor: 'unset' }
        : { backgroundColor: '#f2f2f2' }
      return { ...style, ...conditionalStyle }
    },
    suppressKeyboardEvent,
    minWidth: 150,
    editable: (params) => params.data.provisionOfTheAct === PROVISION_APPROVED_FUEL_CODE,
    tooltipValueGetter: (p) => 'Select the approved fuel code'
  },
  {
    field: 'ciOfFuel',
    headerName: i18n.t('allocationAgreement:allocationAgreementColLabels.ciOfFuel'),
    cellStyle: (params) => cellErrorStyle(params, errors),
    editable: false,
    valueGetter: (params) => {
      if (params.data.provisionOfTheAct === PROVISION_APPROVED_FUEL_CODE) {
        return optionsData?.fuelTypes
          ?.find((obj) => params.data.fuelType === obj.fuelType)
          ?.fuelCodes.find((item) => item.fuelCode === params.data.fuelCode)
          ?.carbonIntensity || 0
      } else {
        return optionsData?.fuelTypes
          ?.find((obj) => params.data.fuelType === obj.fuelType)
          ?.defaultCarbonIntensity || 0
      }
    },
    minWidth: 100
  },
  {
    field: 'quantity',
    headerComponent: HeaderComponent,
    headerName: i18n.t('allocationAgreement:allocationAgreementColLabels.quantity'),
    cellEditor: 'agNumberCellEditor',
    cellEditorParams: {
      precision: 0,
      min: 0,
      showStepperButtons: false
    },
    cellStyle: (params) => cellErrorStyle(params, errors),
    minWidth: 100,
    editable: true
  },
  {
    field: 'units',
    headerName: i18n.t('allocationAgreement:allocationAgreementColLabels.units'),
    cellStyle: (params) => cellErrorStyle(params, errors),
    editable: false,
    minWidth: 80
  },
  

]

export const defaultColDef = {
  editable: true,
  resizable: true,
  filter: true,
  floatingFilter: false,
  sortable: false,
  singleClickEdit: true
}