import { suppressKeyboardEvent } from '@/utils/eventHandlers'
import { Typography } from '@mui/material'
import {
  AutocompleteEditor,
  HeaderComponent
} from '@/components/BCDataGrid/components'
import i18n from '@/i18n'
import { actions, validation } from '@/components/BCDataGrid/columns'

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
    field: 'transactionType',
    headerComponent: HeaderComponent,
    headerName: i18n.t('allocationAgreement:allocationAgreementColLabels.transactionType'),
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
    field: 'tradingPartner',
    headerComponent: HeaderComponent,
    headerName: i18n.t('allocationAgreement:allocationAgreementColLabels.tradingPartner'),
    cellEditor: AutocompleteEditor,
    cellEditorParams: {
      options: optionsData?.tradingPartners?.map((partner) => partner.name),
      freeSolo: true,
      openOnFocus: true
    },
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Enter</Typography>),
    cellStyle: (params) => cellErrorStyle(params, errors),
    suppressKeyboardEvent,
    minWidth: 200,
    editable: true,
    valueSetter: (params) => {
      if (params.newValue) {
        const partner = optionsData?.tradingPartners?.find(
          (p) => p.name === params.newValue
        )
        if (partner) {
          params.data.tradingPartner = params.newValue
          params.data.tradingPartnerAddress = partner.address
          params.data.tradingPartnerEmail = partner.email
          params.data.tradingPartnerPhone = partner.phone
        } else {
          params.data.tradingPartner = params.newValue
          params.data.tradingPartnerAddress = ''
          params.data.tradingPartnerEmail = ''
          params.data.tradingPartnerPhone = ''
        }
      }
      return true
    },
    tooltipValueGetter: (p) => 'Enter or select the legal name of the trading partner'
  },
  {
    field: 'tradingPartnerAddress',
    headerName: i18n.t('allocationAgreement:allocationAgreementColLabels.tradingPartnerAddress'),
    cellEditor: 'agTextCellEditor',
    cellStyle: (params) => cellErrorStyle(params, errors),
    editable: true,
    minWidth: 200
  },
  {
    field: 'tradingPartnerEmail',
    headerName: i18n.t('allocationAgreement:allocationAgreementColLabels.tradingPartnerEmail'),
    cellEditor: 'agTextCellEditor',
    cellStyle: (params) => cellErrorStyle(params, errors),
    editable: true,
    minWidth: 150
  },
  {
    field: 'tradingPartnerPhone',
    headerName: i18n.t('allocationAgreement:allocationAgreementColLabels.tradingPartnerPhone'),
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
        params.data.fuelCategory = fuelType?.fuelCategory
        params.data.units = fuelType?.unit
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
    cellStyle: (params) => cellErrorStyle(params, errors),
    editable: false,
    minWidth: 150
  },
  {
    field: 'determiningCarbonIntensity',
    headerComponent: HeaderComponent,
    headerName: i18n.t('allocationAgreement:allocationAgreementColLabels.determiningCarbonIntensity'),
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: {
      values: ['Approved fuel code - Section 6 (5) (c)', 'Default carbon intensity - Section 6 (5) (d)']
    },
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>),
    cellStyle: (params) => cellErrorStyle(params, errors),
    suppressKeyboardEvent,
    minWidth: 250,
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
      const conditionalStyle = params.data.determiningCarbonIntensity === 'Approved fuel code - Section 6 (5) (c)'
        ? { backgroundColor: '#fff', borderColor: 'unset' }
        : { backgroundColor: '#f2f2f2' }
      return { ...style, ...conditionalStyle }
    },
    suppressKeyboardEvent,
    minWidth: 150,
    editable: (params) => params.data.determiningCarbonIntensity === 'Approved fuel code - Section 6 (5) (c)',
    tooltipValueGetter: (p) => 'Select the approved fuel code'
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
  {
    field: 'energyDensity',
    headerName: i18n.t('allocationAgreement:allocationAgreementColLabels.energyDensity'),
    cellEditor: 'agNumberCellEditor',
    cellEditorParams: {
      precision: 2,
      min: 0,
      showStepperButtons: false
    },
    cellStyle: (params) => {
      const style = cellErrorStyle(params, errors)
      const conditionalStyle = params.data.fuelType === 'Other'
        ? { backgroundColor: '#fff', borderColor: 'unset' }
        : { backgroundColor: '#f2f2f2' }
      return { ...style, ...conditionalStyle }
    },
    valueGetter: (params) => {
      if (params.data.fuelType === 'Other') {
        return params.data?.energyDensity
      } else {
        return optionsData?.fuelTypes?.find(
          (obj) => params.data.fuelType === obj.fuelType
        )?.energyDensity?.energyDensity || 0
      }
    },
    valueSetter: (params) => {
      if (params.data.fuelType === 'Other') {
        params.data.energyDensity = params.newValue
      }
      return true
    },
    editable: (params) => params.data.fuelType === 'Other',
    minWidth: 130
  },
  {
    field: 'ciOfFuel',
    headerName: i18n.t('allocationAgreement:allocationAgreementColLabels.ciOfFuel'),
    cellStyle: (params) => cellErrorStyle(params, errors),
    editable: false,
    valueGetter: (params) => {
      if (params.data.determiningCarbonIntensity === 'Approved fuel code - Section 6 (5) (c)') {
        return optionsData?.fuelTypes
          ?.find((obj) => params.data.fuelType === obj.fuelType)
          ?.fuelCodes.find((item) => item.fuelCode === params.data.fuelCode)
          ?.fuelCodeCarbonIntensity || 0
      } else {
        return optionsData?.fuelTypes
          ?.find((obj) => params.data.fuelType === obj.fuelType)
          ?.defaultCarbonIntensity || 0
      }
    },
    minWidth: 100
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