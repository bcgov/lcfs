import { suppressKeyboardEvent } from '@/utils/grid/eventHandlers'
import BCTypography from '@/components/BCTypography'
import {
  AutocompleteCellEditor,
  RequiredHeader,
  AsyncSuggestionEditor,
  NumberEditor
} from '@/components/BCDataGrid/components'
import i18n from '@/i18n'
import { formatNumberWithCommas as valueFormatter } from '@/utils/formatters'
import { actions, validation } from '@/components/BCDataGrid/columns'
import { apiRoutes } from '@/constants/routes'
import {
  StandardCellStyle,
  StandardCellWarningAndErrors
} from '@/utils/grid/errorRenderers'
import {
  isFuelTypeOther,
  fuelTypeOtherConditionalStyle
} from '@/utils/fuelTypeOther'
import { SelectRenderer } from '@/utils/grid/cellRenderers.jsx'

export const PROVISION_APPROVED_FUEL_CODE = 'Fuel code - section 19 (b) (i)'

export const allocationAgreementColDefs = (
  optionsData,
  currentUser,
  errors,
  warnings
) => [
  validation,
  actions({
    enableDuplicate: false,
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
    headerName: i18n.t(
      'allocationAgreement:allocationAgreementColLabels.complianceReportId'
    ),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    hide: true
  },
  {
    field: 'allocationAgreementId',
    headerName: i18n.t(
      'allocationAgreement:allocationAgreementColLabels.allocationAgreementId'
    ),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    hide: true
  },
  {
    field: 'allocationTransactionType',
    headerComponent: RequiredHeader,
    headerName: i18n.t(
      'allocationAgreement:allocationAgreementColLabels.allocationTransactionType'
    ),
    cellEditor: AutocompleteCellEditor,
    cellEditorParams: {
      options: ['Allocated from', 'Allocated to'],
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    },
    cellRenderer: SelectRenderer,
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
    suppressKeyboardEvent,
    minWidth: 120,
    editable: true,
    tooltipValueGetter: (p) =>
      'Select whether the fuel was purchased or sold under the allocation agreement'
  },
  {
    field: 'transactionPartner',
    headerComponent: RequiredHeader,
    headerName: i18n.t(
      'allocationAgreement:allocationAgreementColLabels.transactionPartner'
    ),
    cellDataType: 'object',
    cellEditor: AsyncSuggestionEditor,
    cellEditorParams: (params) => ({
      queryKey: 'trading-partner-name-search',
      queryFn: async ({ queryKey, client }) => {
        let path = apiRoutes.organizationSearch
        path += 'org_name=' + queryKey[1]
        const response = await client.get(path)
        const filteredData = response.data.filter(
          (org) => org.name !== currentUser.organization.name
        )
        params.node.data.apiDataCache = filteredData
        return filteredData
      },
      title: 'transactionPartner',
      api: params.api,
      minWords: 3
    }),
    cellRenderer: (params) =>
      params.value ||
      (!params.value && (
        <BCTypography variant="body4">Enter or search a name</BCTypography>
      )),
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
    suppressKeyboardEvent,
    minWidth: 310,
    editable: true,
    valueSetter: (params) => {
      const { newValue: selectedName, node, data } = params

      if (typeof selectedName === 'object') {
        // Only update related fields if a match is found in the API data
        data.transactionPartner = selectedName.name
        data.postalAddress = selectedName.address || data.postalAddress
        data.transactionPartnerEmail =
          selectedName.email || data.transactionPartnerEmail
        data.transactionPartnerPhone =
          selectedName.phone || data.transactionPartnerPhone
      } else {
        // If no match, only update the transactionPartner field, leave others unchanged
        data.transactionPartner = selectedName
      }

      return true
    },
    tooltipValueGetter: (p) =>
      'Enter or select the legal name of the trading partner'
  },
  {
    field: 'postalAddress',
    headerComponent: RequiredHeader,
    headerName: i18n.t(
      'allocationAgreement:allocationAgreementColLabels.postalAddress'
    ),
    cellEditor: 'agTextCellEditor',
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
    editable: true,
    minWidth: 350
  },
  {
    field: 'transactionPartnerEmail',
    headerComponent: RequiredHeader,
    headerName: i18n.t(
      'allocationAgreement:allocationAgreementColLabels.transactionPartnerEmail'
    ),
    cellEditor: 'agTextCellEditor',
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
    editable: true,
    minWidth: 200
  },
  {
    field: 'transactionPartnerPhone',
    headerComponent: RequiredHeader,
    headerName: i18n.t(
      'allocationAgreement:allocationAgreementColLabels.transactionPartnerPhone'
    ),
    cellEditor: 'agTextCellEditor',
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
    editable: true,
    minWidth: 200
  },
  {
    field: 'fuelType',
    headerComponent: RequiredHeader,
    headerName: i18n.t(
      'allocationAgreement:allocationAgreementColLabels.fuelType'
    ),
    cellEditor: AutocompleteCellEditor,
    cellEditorParams: {
      options: optionsData?.fuelTypes?.map((obj) => obj.fuelType).sort(),
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    },
    cellRenderer: SelectRenderer,
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
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
        params.data.fuelCategory =
          fuelType.fuelCategories?.[0]?.category ?? null
        params.data.units = fuelType?.unit
        params.data.unrecognized = fuelType?.unrecognized
        params.data.provisionOfTheAct = null
        params.data.fuelCode = undefined
      }
      return true
    },
    tooltipValueGetter: (p) => 'Select the fuel type from the list'
  },
  {
    field: 'fuelTypeOther',
    headerName: i18n.t(
      'allocationAgreement:allocationAgreementColLabels.fuelTypeOther'
    ),
    cellEditor: AsyncSuggestionEditor,
    cellEditorParams: (params) => ({
      queryKey: 'fuel-type-others',
      queryFn: async ({ queryKey, client }) => {
        const path = apiRoutes.getFuelTypeOthers

        const response = await client.get(path)

        params.node.data.apiDataCache = response.data
        return response.data
      },
      title: 'transactionPartner',
      api: params.api,
      minWords: 1
    }),
    cellStyle: (params) =>
      StandardCellStyle(
        params,
        errors,
        warnings,
        fuelTypeOtherConditionalStyle
      ),
    valueSetter: (params) => {
      const { newValue: selectedFuelTypeOther, data } = params
      data.fuelTypeOther = selectedFuelTypeOther
      return true
    },
    editable: (params) => isFuelTypeOther(params),
    minWidth: 250
  },
  {
    field: 'fuelCategory',
    headerComponent: RequiredHeader,
    headerName: i18n.t(
      'allocationAgreement:allocationAgreementColLabels.fuelCategory'
    ),
    cellEditor: AutocompleteCellEditor,
    cellEditorParams: (params) => ({
      options:
        optionsData?.fuelTypes
          ?.find((obj) => params.data.fuelType === obj.fuelType)
          ?.fuelCategories.map((item) => item.fuelCategory)
          .sort() || [],
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    }),
    suppressKeyboardEvent,
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
    minWidth: 150,
    valueSetter: (params) => {
      if (params.newValue) {
        params.data.fuelCategory = params.newValue
        params.data.fuelCategoryId = optionsData?.fuelTypes
          ?.find((obj) => params.data.fuelType === obj.fuelType)
          ?.fuelCategories?.find(
            (obj) => params.newValue === obj.fuelCategory
          )?.fuelCategoryId
        params.data.provisionOfTheAct = null
        params.data.provisionOfTheActId = null
      }
      return true
    },
    valueGetter: (params) => params.data.fuelCategory,
    editable: (params) =>
      optionsData?.fuelTypes?.find(
        (obj) => params.data.fuelType === obj.fuelType
      )?.fuelCategories.length > 1 && params.data.fuelType != null
  },
  {
    field: 'provisionOfTheAct',
    headerComponent: RequiredHeader,
    headerName: i18n.t(
      'allocationAgreement:allocationAgreementColLabels.provisionOfTheAct'
    ),
    cellEditor: AutocompleteCellEditor,
    cellEditorParams: (params) => ({
      options: optionsData?.fuelTypes
        ?.find((obj) => params.data.fuelType === obj.fuelType)
        ?.provisions.map((item) => item.name)
        .sort(),
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    }),
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <BCTypography variant="body4">Select</BCTypography>),
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
    suppressKeyboardEvent,
    minWidth: 300,
    valueSetter: (params) => {
      if (params.newValue) {
        params.data.provisionOfTheAct = params.newValue
        params.data.provisionOfTheActId = optionsData?.fuelTypes
          ?.find((obj) => params.data.fuelType === obj.fuelType)
          ?.provisions.find(
            (item) => item.name === params.newValue
          )?.provisionOfTheActId
        params.data.fuelCode = null
        params.data.fuelCodeId = null
      }
      return true
    },
    editable: true,
    tooltipValueGetter: (p) =>
      'Select the method for determining carbon intensity'
  },
  {
    field: 'fuelCode',
    headerName: i18n.t(
      'allocationAgreement:allocationAgreementColLabels.fuelCode'
    ),
    cellEditor: AutocompleteCellEditor,
    cellEditorParams: (params) => {
      const fuelType = optionsData?.fuelTypes?.find(
        (obj) => params.data.fuelType === obj.fuelType
      )
      return {
        options: fuelType?.fuelCodes.map((item) => item.fuelCode) || [],
        multiple: false,
        disableCloseOnSelect: false,
        freeSolo: false,
        openOnFocus: true
      }
    },
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
    suppressKeyboardEvent,
    minWidth: 150,
    editable: (params) =>
      params.data.provisionOfTheAct === PROVISION_APPROVED_FUEL_CODE &&
      optionsData?.fuelTypes?.find(
        (obj) => params.data.fuelType === obj.fuelType
      )?.fuelCodes?.length > 0,
    valueGetter: (params) => {
      const fuelTypeObj = optionsData?.fuelTypes?.find(
        (obj) => params.data.fuelType === obj.fuelType
      )
      if (!fuelTypeObj) return params.data.fuelCode

      const isFuelCodeScenario =
        params.data.provisionOfTheAct === PROVISION_APPROVED_FUEL_CODE
      const fuelCodes =
        fuelTypeObj.fuelCodes?.map((item) => item.fuelCode) || []

      if (isFuelCodeScenario && !params.data.fuelCode) {
        // Auto-populate if only one fuel code is available
        if (fuelCodes.length === 1) {
          const singleFuelCode = fuelTypeObj.fuelCodes[0]
          params.data.fuelCode = singleFuelCode.fuelCode
          params.data.fuelCodeId = singleFuelCode.fuelCodeId
        }
      }

      return params.data.fuelCode
    },
    valueSetter: (params) => {
      if (params.newValue) {
        params.data.fuelCode = params.newValue

        const fuelType = optionsData?.fuelTypes?.find(
          (obj) => params.data.fuelType === obj.fuelType
        )
        if (params.data.provisionOfTheAct === PROVISION_APPROVED_FUEL_CODE) {
          const matchingFuelCode = fuelType?.fuelCodes?.find(
            (fuelCode) => params.data.fuelCode === fuelCode.fuelCode
          )
          if (matchingFuelCode) {
            params.data.fuelCodeId = matchingFuelCode.fuelCodeId
          }
        }
      } else {
        // If user clears the value
        params.data.fuelCode = undefined
        params.data.fuelCodeId = undefined
      }
      return true
    },
    tooltipValueGetter: (p) => 'Select the approved fuel code'
  },
  {
    field: 'ciOfFuel',
    headerName: i18n.t(
      'allocationAgreement:allocationAgreementColLabels.ciOfFuel'
    ),
    valueFormatter: (params) => {
      return params.value != null ? parseFloat(params.value).toFixed(2) : ''
    },
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
    editable: false,
    minWidth: 100
  },
  {
    field: 'quantity',
    headerComponent: RequiredHeader,
    headerName: i18n.t(
      'allocationAgreement:allocationAgreementColLabels.quantity'
    ),
    editor: NumberEditor,
    valueFormatter: (params) => valueFormatter({ value: params.value }),
    cellEditor: NumberEditor,
    cellEditorParams: {
      precision: 0,
      min: 0,
      showStepperButtons: false
    },
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
    minWidth: 100,
    editable: true
  },
  {
    field: 'units',
    headerName: i18n.t(
      'allocationAgreement:allocationAgreementColLabels.units'
    ),
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
    editable: false,
    minWidth: 80
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
