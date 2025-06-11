import { actions, validation } from '@/components/BCDataGrid/columns'
import {
  AsyncSuggestionEditor,
  AutocompleteCellEditor,
  NumberEditor,
  RequiredHeader
} from '@/components/BCDataGrid/components'
import BCTypography from '@/components/BCTypography'
import { apiRoutes } from '@/constants/routes'
import { ACTION_STATUS_MAP } from '@/constants/schemaConstants'
import i18n from '@/i18n'
import colors from '@/themes/base/colors'
import { formatNumberWithCommas as valueFormatter } from '@/utils/formatters'
import {
  fuelTypeOtherConditionalStyle,
  isFuelTypeOther
} from '@/utils/fuelTypeOther'
import { SelectRenderer } from '@/utils/grid/cellRenderers.jsx'
import { changelogCellStyle } from '@/utils/grid/changelogCellStyle'
import {
  StandardCellStyle,
  StandardCellWarningAndErrors
} from '@/utils/grid/errorRenderers'
import { suppressKeyboardEvent } from '@/utils/grid/eventHandlers'
import { isQuarterEditable } from '@/utils/grid/cellEditables.jsx'

export const PROVISION_APPROVED_FUEL_CODE = 'Fuel code - section 19 (b) (i)'

export const allocationAgreementColDefs = (
  optionsData,
  orgName,
  errors,
  warnings,
  isSupplemental,
  compliancePeriod,
  isEarlyIssuance = false
) => {
  const baseColumns = [
    validation,
    actions((params) => {
      return {
        enableDuplicate: false,
        enableDelete: !params.data.isNewSupplementalEntry,
        enableUndo: isSupplemental && params.data.isNewSupplementalEntry,
        enableStatus:
          isSupplemental &&
          params.data.isNewSupplementalEntry &&
          ACTION_STATUS_MAP[params.data.actionType]
      }
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
        StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),
      suppressKeyboardEvent,
      minWidth: 175,
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
            (org) => org.name !== orgName
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
        StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),
      suppressKeyboardEvent,
      minWidth: 310,
      editable: true,
      valueSetter: (params) => {
        const { newValue: selectedName, data } = params

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
        StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),
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
        StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),
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
        StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),
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
        StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),
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
      cellRenderer: SelectRenderer,
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),
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
      cellRenderer: SelectRenderer,
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),
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
      cellRenderer: SelectRenderer,
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),
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
        StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),
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
        StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),
      minWidth: 100,
      editable: true
    },
    {
      field: 'units',
      headerName: i18n.t(
        'allocationAgreement:allocationAgreementColLabels.units'
      ),
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),
      editable: false,
      minWidth: 80
    }
  ]

  // Swap in Quarterly Columns if it's an early issuance report
  if (isEarlyIssuance) {
    return baseColumns.flatMap((item) => {
      if (item.field === 'quantity') {
        return [
          {
            field: 'q1Quantity',
            headerComponent: RequiredHeader,
            headerName: i18n.t(
              'allocationAgreement:allocationAgreementColLabels.q1Quantity'
            ),
            valueFormatter: (params) => valueFormatter({ value: params.value }),
            cellEditor: NumberEditor,
            cellEditorParams: {
              precision: 0,
              min: 0,
              showStepperButtons: false
            },
            cellStyle: (params) =>
              StandardCellWarningAndErrors(
                params,
                errors,
                warnings,
                isSupplemental
              ),
            minWidth: 175,
            width: 175,
            flex: 0,
            editable: () => {
              return isQuarterEditable(1, compliancePeriod)
            }
          },
          {
            field: 'q2Quantity',
            headerComponent: RequiredHeader,
            headerName: i18n.t(
              'allocationAgreement:allocationAgreementColLabels.q2Quantity'
            ),
            valueFormatter: (params) => valueFormatter({ value: params.value }),
            cellEditor: NumberEditor,
            cellEditorParams: {
              precision: 0,
              min: 0,
              showStepperButtons: false
            },
            cellStyle: (params) =>
              StandardCellWarningAndErrors(
                params,
                errors,
                warnings,
                isSupplemental
              ),
            minWidth: 175,
            width: 175,
            flex: 0,
            editable: () => {
              return isQuarterEditable(2, compliancePeriod)
            }
          },
          {
            field: 'q3Quantity',
            headerComponent: RequiredHeader,
            headerName: i18n.t(
              'allocationAgreement:allocationAgreementColLabels.q3Quantity'
            ),
            valueFormatter: (params) => valueFormatter({ value: params.value }),
            cellEditor: NumberEditor,
            cellEditorParams: {
              precision: 0,
              min: 0,
              showStepperButtons: false
            },
            cellStyle: (params) =>
              StandardCellWarningAndErrors(
                params,
                errors,
                warnings,
                isSupplemental
              ),
            minWidth: 175,
            width: 175,
            flex: 0,
            editable: () => {
              return isQuarterEditable(3, compliancePeriod)
            }
          },
          {
            field: 'q4Quantity',
            headerComponent: RequiredHeader,
            headerName: i18n.t(
              'allocationAgreement:allocationAgreementColLabels.q4Quantity'
            ),
            valueFormatter: (params) => valueFormatter({ value: params.value }),
            cellEditor: NumberEditor,
            cellEditorParams: {
              precision: 0,
              min: 0,
              showStepperButtons: false
            },
            cellStyle: (params) =>
              StandardCellWarningAndErrors(
                params,
                errors,
                warnings,
                isSupplemental
              ),
            minWidth: 175,
            width: 175,
            flex: 0,
            editable: () => {
              return isQuarterEditable(4, compliancePeriod)
            }
          },
          {
            field: 'totalQuantity',
            headerName: i18n.t(
              'allocationAgreement:allocationAgreementColLabels.totalQuantity'
            ),
            valueFormatter: (params) => valueFormatter({ value: params.value }),
            cellStyle: (params) =>
              StandardCellWarningAndErrors(
                params,
                errors,
                warnings,
                isSupplemental
              ),
            minWidth: 175,
            width: 175,
            flex: 0,
            valueGetter: (params) => {
              const data = params.data
              return (
                (data.q1Quantity || 0) +
                (data.q2Quantity || 0) +
                (data.q3Quantity || 0) +
                (data.q4Quantity || 0)
              )
            },
            editable: false
          }
        ]
      }

      return [item]
    })
  }

  return baseColumns
}

export const allocationAgreementSummaryColDef = (isEarlyIssuance) => {
  const baseColumns = [
    {
      headerName: i18n.t(
        'allocationAgreement:allocationAgreementColLabels.allocationTransactionType'
      ),
      field: 'allocationTransactionType'
    },
    {
      headerName: i18n.t(
        'allocationAgreement:allocationAgreementColLabels.transactionPartner'
      ),
      field: 'transactionPartner'
    },
    {
      headerName: i18n.t(
        'allocationAgreement:allocationAgreementColLabels.postalAddress'
      ),
      field: 'postalAddress'
    },
    {
      headerName: i18n.t(
        'allocationAgreement:allocationAgreementColLabels.transactionPartnerEmail'
      ),
      field: 'transactionPartnerEmail'
    },
    {
      headerName: i18n.t(
        'allocationAgreement:allocationAgreementColLabels.transactionPartnerPhone'
      ),
      field: 'transactionPartnerPhone'
    },
    {
      headerName: i18n.t(
        'allocationAgreement:allocationAgreementColLabels.fuelType'
      ),
      field: 'fuelType'
    },
    {
      headerName: i18n.t(
        'allocationAgreement:allocationAgreementColLabels.fuelCategory'
      ),
      field: 'fuelCategory'
    },
    {
      headerName: i18n.t(
        'allocationAgreement:allocationAgreementColLabels.provisionOfTheAct'
      ),
      field: 'provisionOfTheAct'
    },
    {
      headerName: i18n.t(
        'allocationAgreement:allocationAgreementColLabels.fuelCode'
      ),
      field: 'fuelCode'
    },
    {
      headerName: i18n.t(
        'allocationAgreement:allocationAgreementColLabels.ciOfFuel'
      ),
      field: 'ciOfFuel'
    },
    {
      headerName: i18n.t(
        'allocationAgreement:allocationAgreementColLabels.quantity'
      ),
      field: 'quantity',
      valueFormatter
    },
    {
      headerName: i18n.t(
        'allocationAgreement:allocationAgreementColLabels.units'
      ),
      field: 'units'
    }
  ]

  if (isEarlyIssuance) {
    return baseColumns.flatMap((item) => {
      if (item.field === 'quantity') {
        return [
          {
            field: 'q1Quantity',
            headerName: i18n.t(
              'allocationAgreement:allocationAgreementColLabels.q1Quantity'
            ),
            valueFormatter
          },
          {
            field: 'q2Quantity',
            headerName: i18n.t(
              'allocationAgreement:allocationAgreementColLabels.q2Quantity'
            ),
            valueFormatter
          },
          {
            field: 'q3Quantity',
            headerName: i18n.t(
              'allocationAgreement:allocationAgreementColLabels.q3Quantity'
            ),
            valueFormatter
          },
          {
            field: 'q4Quantity',
            headerName: i18n.t(
              'allocationAgreement:allocationAgreementColLabels.q4Quantity'
            ),
            valueFormatter
          },
          {
            field: 'totalQuantity',
            headerName: i18n.t(
              'allocationAgreement:allocationAgreementColLabels.totalQuantity'
            ),
            valueFormatter,
            valueGetter: (params) => {
              const data = params.data
              return (
                (data.q1Quantity || 0) +
                (data.q2Quantity || 0) +
                (data.q3Quantity || 0) +
                (data.q4Quantity || 0)
              )
            }
          }
        ]
      }

      return [item]
    })
  }

  return baseColumns
}

export const defaultColDef = {
  editable: true,
  resizable: true,
  filter: false,
  floatingFilter: false,
  sortable: false,
  singleClickEdit: true,
  flex: 1
}

export const changelogCommonColDefs = (highlight = true) => [
  {
    headerName: i18n.t(
      'allocationAgreement:allocationAgreementColLabels.allocationTransactionType'
    ),
    field: 'allocationTransactionType.type',
    cellStyle: (params) =>
      highlight && changelogCellStyle(params, 'allocationTransactionType')
  },
  {
    headerName: i18n.t(
      'allocationAgreement:allocationAgreementColLabels.transactionPartner'
    ),
    field: 'transactionPartner',
    cellStyle: (params) =>
      highlight && changelogCellStyle(params, 'transactionPartner')
  },
  {
    headerName: i18n.t(
      'allocationAgreement:allocationAgreementColLabels.postalAddress'
    ),
    field: 'postalAddress',
    cellStyle: (params) =>
      highlight && changelogCellStyle(params, 'postalAddress')
  },
  {
    headerName: i18n.t(
      'allocationAgreement:allocationAgreementColLabels.transactionPartnerEmail'
    ),
    field: 'transactionPartnerEmail',
    cellStyle: (params) =>
      highlight && changelogCellStyle(params, 'transactionPartnerEmail')
  },
  {
    headerName: i18n.t(
      'allocationAgreement:allocationAgreementColLabels.transactionPartnerPhone'
    ),
    field: 'transactionPartnerPhone',
    cellStyle: (params) =>
      highlight && changelogCellStyle(params, 'transactionPartnerPhone')
  },
  {
    headerName: i18n.t(
      'allocationAgreement:allocationAgreementColLabels.fuelType'
    ),
    field: 'fuelType.fuelType',
    cellStyle: (params) => highlight && changelogCellStyle(params, 'fuelType')
  },
  {
    headerName: i18n.t(
      'allocationAgreement:allocationAgreementColLabels.fuelTypeOther'
    ),
    field: 'fuelTypeOther',
    cellStyle: (params) =>
      highlight && changelogCellStyle(params, 'fuelTypeOther')
  },
  {
    headerName: i18n.t(
      'allocationAgreement:allocationAgreementColLabels.fuelCategory'
    ),
    field: 'fuelCategory.category',
    cellStyle: (params) =>
      highlight && changelogCellStyle(params, 'fuelCategory')
  },
  {
    headerName: i18n.t(
      'allocationAgreement:allocationAgreementColLabels.provisionOfTheAct'
    ),
    field: 'provisionOfTheAct.name',
    cellStyle: (params) =>
      highlight && changelogCellStyle(params, 'provisionOfTheAct')
  },
  {
    headerName: i18n.t(
      'allocationAgreement:allocationAgreementColLabels.fuelCode'
    ),
    field: 'fuelCode.fuel_code',
    cellStyle: (params) => highlight && changelogCellStyle(params, 'fuelCode')
  },
  {
    headerName: i18n.t(
      'allocationAgreement:allocationAgreementColLabels.ciOfFuel'
    ),
    field: 'ciOfFuel',
    cellStyle: (params) => highlight && changelogCellStyle(params, 'ciOfFuel')
  },
  {
    headerName: i18n.t(
      'allocationAgreement:allocationAgreementColLabels.quantity'
    ),
    field: 'quantity',
    cellStyle: (params) => highlight && changelogCellStyle(params, 'quantity')
  },
  {
    headerName: i18n.t(
      'allocationAgreement:allocationAgreementColLabels.q1Quantity'
    ),
    field: 'q1Quantity',
    cellStyle: (params) => highlight && changelogCellStyle(params, 'q1Quantity')
  },
  {
    headerName: i18n.t(
      'allocationAgreement:allocationAgreementColLabels.q2Quantity'
    ),
    field: 'q2Quantity',
    cellStyle: (params) => highlight && changelogCellStyle(params, 'q2Quantity')
  },
  {
    headerName: i18n.t(
      'allocationAgreement:allocationAgreementColLabels.q3Quantity'
    ),
    field: 'q3Quantity',
    cellStyle: (params) => highlight && changelogCellStyle(params, 'q3Quantity')
  },
  {
    headerName: i18n.t(
      'allocationAgreement:allocationAgreementColLabels.q4Quantity'
    ),
    field: 'q4Quantity',
    cellStyle: (params) => highlight && changelogCellStyle(params, 'q4Quantity')
  },
  {
    headerName: i18n.t(
      'allocationAgreement:allocationAgreementColLabels.units'
    ),
    field: 'units',
    cellStyle: (params) => highlight && changelogCellStyle(params, 'units')
  }
]

export const changelogColDefs = (highlight = true) => [
  {
    field: 'groupUuid',
    hide: true,
    sort: 'desc',
    sortIndex: 3
  },
  { field: 'createDate', hide: true, sort: 'asc', sortIndex: 1 },
  { field: 'version', hide: true, sort: 'desc', sortIndex: 2 },
  {
    field: 'actionType',
    valueGetter: (params) => {
      if (params.data.actionType === 'UPDATE') {
        if (params.data.updated) {
          return 'Edited old'
        } else {
          return 'Edited new'
        }
      }
      if (params.data.actionType === 'DELETE') {
        return 'Deleted'
      }
      if (params.data.actionType === 'CREATE') {
        return 'Added'
      }
    },
    cellStyle: (params) => {
      if (highlight && params.data.actionType === 'UPDATE') {
        return { backgroundColor: colors.alerts.warning.background }
      }
    }
  },
  ...changelogCommonColDefs(highlight)
]

export const changelogDefaultColDefs = {
  floatingFilter: false,
  filter: false
}

export const changelogCommonGridOptions = {
  overlayNoRowsTemplate: i18n.t(
    'allocationAgreement:noAllocationAgreementsFound'
  ),
  autoSizeStrategy: {
    type: 'fitCellContents',
    defaultMinWidth: 50,
    defaultMaxWidth: 600
  },
  enableCellTextSelection: true,
  ensureDomOrder: true
}

export const changelogGridOptions = {
  ...changelogCommonGridOptions,
  getRowStyle: (params) => {
    if (params.data.actionType === 'DELETE') {
      return {
        backgroundColor: colors.alerts.error.background
      }
    }
    if (params.data.actionType === 'CREATE') {
      return {
        backgroundColor: colors.alerts.success.background
      }
    }
  }
}

export const allocAgrmtSummaryColDefs = (t) => [
  {
    headerName: t(
      'allocationAgreement:allocationAgreementColLabels.allocationTransactionType'
    ),
    field: 'allocationTransactionType'
  },
  {
    headerName: t(
      'allocationAgreement:allocationAgreementColLabels.transactionPartner'
    ),
    field: 'transactionPartner'
  },
  {
    headerName: t(
      'allocationAgreement:allocationAgreementColLabels.postalAddress'
    ),
    field: 'postalAddress'
  },
  {
    headerName: t(
      'allocationAgreement:allocationAgreementColLabels.transactionPartnerEmail'
    ),
    field: 'transactionPartnerEmail'
  },
  {
    headerName: t(
      'allocationAgreement:allocationAgreementColLabels.transactionPartnerPhone'
    ),
    field: 'transactionPartnerPhone'
  },
  {
    headerName: t('allocationAgreement:allocationAgreementColLabels.fuelType'),
    field: 'fuelType'
  },
  {
    headerName: t(
      'allocationAgreement:allocationAgreementColLabels.fuelCategory'
    ),
    field: 'fuelCategory'
  },
  {
    headerName: t(
      'allocationAgreement:allocationAgreementColLabels.carbonIntensity'
    ),
    field: 'provisionOfTheAct'
  },
  {
    headerName: t('allocationAgreement:allocationAgreementColLabels.fuelCode'),
    field: 'fuelCode'
  },
  {
    headerName: t('allocationAgreement:allocationAgreementColLabels.ciOfFuel'),
    field: 'ciOfFuel'
  },
  {
    headerName: t('allocationAgreement:allocationAgreementColLabels.quantity'),
    field: 'quantity',
    valueFormatter
  },
  {
    headerName: t('allocationAgreement:allocationAgreementColLabels.units'),
    field: 'units'
  }
]
