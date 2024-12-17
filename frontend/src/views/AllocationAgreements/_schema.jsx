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
  StandardCellErrors,
  StandardCellStyle
} from '@/utils/grid/errorRenderers'
import {
  isFuelTypeOther,
  fuelTypeOtherConditionalStyle
} from '@/utils/fuelTypeOther'

export const PROVISION_APPROVED_FUEL_CODE = 'Fuel code - section 19 (b) (i)'

export const allocationAgreementColDefs = (optionsData, errors) => [
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
      'allocationAgreement:allocationAgreementColLabels.transaction'
    ),
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: {
      values: ['Allocated from', 'Allocated to']
    },
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <BCTypography variant="body4">Select</BCTypography>),
    cellStyle: (params) => StandardCellErrors(params, errors),
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
    cellDataType: 'text',
    cellEditor: AsyncSuggestionEditor,
    cellEditorParams: (params) => ({
      queryKey: 'trading-partner-name-search',
      queryFn: async ({ queryKey, client }) => {
        let path = apiRoutes.organizationSearch
        path += 'org_name=' + queryKey[1]
        const response = await client.get(path)
        params.node.data.apiDataCache = response.data
        return response.data
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
    cellStyle: (params) => StandardCellErrors(params, errors),
    suppressKeyboardEvent,
    minWidth: 310,
    editable: true,
    valueSetter: (params) => {
      const { newValue: selectedName, node, data } = params
      const apiData = node.data.apiDataCache || [] // Safely access cached data or default to an empty array

      // Attempt to find the selected company from the cached API data
      const selectedOption = apiData.find(
        (company) => company.name === selectedName
      )

      if (selectedOption) {
        // Only update related fields if a match is found in the API data
        data.transactionPartner = selectedOption.name
        data.postalAddress = selectedOption.address || data.postalAddress
        data.transactionPartnerEmail =
          selectedOption.email || data.transactionPartnerEmail
        data.transactionPartnerPhone =
          selectedOption.phone || data.transactionPartnerPhone
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
    cellStyle: (params) => StandardCellErrors(params, errors),
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
    cellStyle: (params) => StandardCellErrors(params, errors),
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
    cellStyle: (params) => StandardCellErrors(params, errors),
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
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <BCTypography variant="body4">Select</BCTypography>),
    cellStyle: (params) => StandardCellErrors(params, errors),
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
        params.data.units = fuelType?.units
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
      StandardCellStyle(params, errors, null, fuelTypeOtherConditionalStyle),
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
    headerName: i18n.t(
      'allocationAgreement:allocationAgreementColLabels.fuelCategory'
    ),
    cellEditor: AutocompleteCellEditor,
    cellEditorParams: (params) => ({
      options:
        optionsData?.fuelTypes
          ?.find((obj) => params.data.fuelType === obj.fuelType)
          ?.fuelCategories.map((item) => item.category) || [],
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    }),
    suppressKeyboardEvent,
    minWidth: 150,
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
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: (params) => {
      const fuelType = optionsData?.fuelTypes?.find(
        (type) => type.fuelType === params.data.fuelType
      )

      const provisionsOfTheAct = fuelType
        ? fuelType.provisionOfTheAct.map((provision) => provision.name)
        : []

      return {
        values: provisionsOfTheAct.sort()
      }
    },
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <BCTypography variant="body4">Select</BCTypography>),
    cellStyle: (params) => StandardCellErrors(params, errors),
    suppressKeyboardEvent,
    minWidth: 300,
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
    cellEditorParams: (params) => ({
      options:
        optionsData?.fuelTypes
          ?.find((obj) => params.data.fuelType === obj.fuelType)
          ?.fuelCodes.map((item) => item.fuelCode) || [],
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    }),
    cellStyle: (params) => {
      const style = StandardCellErrors(params, errors)
      const isFuelCodeScenario =
        params.data.provisionOfTheAct === PROVISION_APPROVED_FUEL_CODE
      const fuelType = optionsData?.fuelTypes?.find(
        (obj) => params.data.fuelType === obj.fuelType
      )
      const fuelCodes = fuelType?.fuelCodes || []
      const fuelCodeRequiredAndMissing =
        isFuelCodeScenario && !params.data.fuelCode

      let conditionalStyle = {}

      // If required and missing, show red border and white background
      if (fuelCodeRequiredAndMissing) {
        style.borderColor = 'red'
        style.backgroundColor = '#fff'
      } else {
        // Apply conditional styling if not missing
        conditionalStyle =
          isFuelCodeScenario && fuelCodes.length > 0
            ? {
                backgroundColor: '#fff',
                borderColor: style.borderColor || 'unset'
              }
            : { backgroundColor: '#f2f2f2' }
      }

      return { ...style, ...conditionalStyle }
    },
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
        // Autopopulate if only one fuel code is available
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
      return parseFloat(params.value).toFixed(2)
    },
    cellStyle: (params) => StandardCellErrors(params, errors),
    editable: false,
    valueGetter: (params) => {
      if (params.data.provisionOfTheAct === PROVISION_APPROVED_FUEL_CODE) {
        return (
          optionsData?.fuelTypes
            ?.find((obj) => params.data.fuelType === obj.fuelType)
            ?.fuelCodes.find((item) => item.fuelCode === params.data.fuelCode)
            ?.carbonIntensity || 0
        )
      } else {
        if (optionsData) {
          if (isFuelTypeOther(params) && params.data.fuelCategory) {
            const categories = optionsData?.fuelTypes?.find(
              (obj) => params.data.fuelType === obj.fuelType
            ).fuelCategories

            const defaultCI = categories.find(
              (cat) => cat.category === params.data.fuelCategory
            ).defaultAndPrescribedCi

            return defaultCI
          }
        }
        return (
          optionsData?.fuelTypes?.find(
            (obj) => params.data.fuelType === obj.fuelType
          )?.defaultCarbonIntensity || 0
        )
      }
    },
    minWidth: 100
  },
  {
    field: 'quantity',
    headerComponent: RequiredHeader,
    headerName: i18n.t(
      'allocationAgreement:allocationAgreementColLabels.quantity'
    ),
    editor: NumberEditor,
    valueFormatter,
    cellEditor: NumberEditor,
    cellEditorParams: {
      precision: 0,
      min: 0,
      showStepperButtons: false
    },
    cellStyle: (params) => StandardCellErrors(params, errors),
    minWidth: 100,
    editable: true
  },
  {
    field: 'units',
    headerName: i18n.t(
      'allocationAgreement:allocationAgreementColLabels.units'
    ),
    cellStyle: (params) => StandardCellErrors(params, errors),
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
