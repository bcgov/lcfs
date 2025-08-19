import { actions, validation } from '@/components/BCDataGrid/columns'
import {
  AsyncSuggestionEditor,
  AutocompleteCellEditor,
  NumberEditor,
  RequiredHeader
} from '@/components/BCDataGrid/components'
import { apiRoutes } from '@/constants/routes'
import { ACTION_STATUS_MAP } from '@/constants/schemaConstants'
import i18n from '@/i18n'
import colors from '@/themes/base/colors'
import { formatNumberWithCommas } from '@/utils/formatters'
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
import {
  formatFuelCodeOptions,
  extractOriginalFuelCode,
  formatFuelCodeWithCountryPrefix
} from '@/utils/fuelCodeCountryPrefix'
import { NEW_REGULATION_YEAR } from '@/constants/common'

export const PROVISION_APPROVED_FUEL_CODE = 'Fuel code - section 19 (b) (i)'
export const DEFAULT_CI_FUEL_CODE =
  'Default carbon intensity - section 19 (b) (ii)'
export const PROVISION_GHGENIUS =
  'GHGenius modelled - Section 6 (5) (d) (ii) (A)'

export const fuelSupplyColDefs = (
  optionsData,
  errors,
  warnings,
  compliancePeriod,
  isSupplemental,
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
      headerName: i18n.t('fuelSupply:fuelSupplyColLabels.complianceReportId'),
      cellEditor: 'agTextCellEditor',
      cellDataType: 'text',
      hide: true
    },
    {
      field: 'fuelSupplyId',
      headerName: i18n.t('fuelSupply:fuelSupplyColLabels.fuelSupplyId'),
      cellEditor: 'agTextCellEditor',
      cellDataType: 'text',
      hide: true
    },
    {
      field: 'fuelCodeId',
      cellEditor: 'agTextCellEditor',
      cellDataType: 'text',
      hide: true
    },
    {
      field: 'endUseId',
      cellEditor: 'agTextCellEditor',
      cellDataType: 'text',
      hide: true
    },
    {
      field: 'complianceUnits',
      headerName: i18n.t('fuelSupply:fuelSupplyColLabels.complianceUnits'),
      minWidth: 100,
      valueFormatter: formatNumberWithCommas,
      editable: false,
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings, isSupplemental)
    },
    {
      field: 'fuelType',
      headerComponent: RequiredHeader,
      headerName: i18n.t('fuelSupply:fuelSupplyColLabels.fuelType'),
      cellEditor: AutocompleteCellEditor,
      cellRenderer: SelectRenderer,
      cellEditorParams: {
        options: optionsData?.fuelTypes?.map((obj) => obj.fuelType).sort(),
        multiple: false,
        disableCloseOnSelect: false,
        freeSolo: false,
        openOnFocus: true
      },
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),

      suppressKeyboardEvent,
      minWidth: 260,
      editable: true,
      valueGetter: (params) => params.data.fuelType,
      valueSetter: (params) => {
        if (params.newValue) {
          const fuelType = optionsData?.fuelTypes?.find(
            (obj) => obj.fuelType === params.newValue
          )
          params.data.fuelType = params.newValue
          params.data.fuelTypeId = fuelType?.fuelTypeId
          params.data.fuelTypeOther = null
          params.data.fuelCategory = null
          params.data.fuelCategoryId = null
          params.data.endUseId = null
          params.data.endUseType = null
          params.data.eer = null
          params.data.provisionOfTheAct = null
          params.data.provisionOfTheActId = null
          params.data.fuelCode = null
          params.data.fuelCodeId = null
          params.data.units = fuelType?.unit
          params.data.unrecognized = fuelType?.unrecognized
        }
        return true
      },
      tooltipValueGetter: () => 'Select the fuel type from the list'
    },
    {
      field: 'fuelTypeOther',
      headerName: i18n.t('fuelSupply:fuelSupplyColLabels.fuelTypeOther'),
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
      editable: (params) => {
        return isFuelTypeOther(params)
      },
      minWidth: 250
    },
    {
      field: 'fuelCategory',
      headerComponent: RequiredHeader,
      headerName: i18n.t('fuelSupply:fuelSupplyColLabels.fuelCategoryId'),
      cellEditor: AutocompleteCellEditor,
      cellRenderer: SelectRenderer,
      cellEditorParams: (params) => ({
        options: optionsData?.fuelTypes
          ?.find((obj) => params.data.fuelType === obj.fuelType)
          ?.fuelCategories.map((item) => item.fuelCategory)
          .sort(),
        multiple: false,
        disableCloseOnSelect: false,
        freeSolo: false,
        openOnFocus: true
      }),
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),
      valueSetter: (params) => {
        if (params.newValue) {
          params.data.fuelCategory = params.newValue
          params.data.fuelCategoryId = optionsData?.fuelTypes
            ?.find((obj) => params.data.fuelType === obj.fuelType)
            ?.fuelCategories?.find(
              (obj) => params.newValue === obj.fuelCategory
            )?.fuelCategoryId
          params.data.endUseId = null
          params.data.endUseType = null
          params.data.eer = null
          params.data.provisionOfTheAct = null
          params.data.provisionOfTheActId = null
          params.data.fuelCode = null
        }
        return true
      },
      suppressKeyboardEvent,
      minWidth: 135,
      valueGetter: (params) => params.data.fuelCategory,
      editable: (params) =>
        optionsData?.fuelTypes
          ?.find((obj) => params.data.fuelType === obj.fuelType)
          ?.fuelCategories.map((item) => item.fuelCategory).length > 1,
      tooltipValueGetter: () => 'Select the fuel category from the list'
    },
    {
      field: 'endUseType',
      headerComponent: RequiredHeader,
      headerName: i18n.t('fuelSupply:fuelSupplyColLabels.endUseId'),
      cellEditorParams: (params) => ({
        options: [
          ...new Set(
            optionsData?.fuelTypes
              ?.find((obj) => params.data.fuelType === obj.fuelType)
              ?.eerRatios.filter(
                (item) =>
                  item.fuelCategory.fuelCategory === params.data.fuelCategory
              )
              ?.map((item) => item.endUseType.type)
              .sort()
          )
        ].filter((item) => item != null),
        multiple: false,
        disableCloseOnSelect: false,
        freeSolo: false,
        openOnFocus: true
      }),
      cellEditor: AutocompleteCellEditor,
      cellRenderer: SelectRenderer,
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),
      suppressKeyboardEvent,
      valueGetter: (params) => params.data.endUseType,
      editable: (params) => {
        const cellParams = params.colDef?.cellEditorParams(params)
        return cellParams.options.length > 1
      },
      valueSetter: (params) => {
        if (params.newValue) {
          const eerRatio = optionsData?.fuelTypes
            ?.find((obj) => params.data.fuelType === obj.fuelType)
            ?.eerRatios.filter(
              (item) =>
                item.fuelCategory.fuelCategory === params.data.fuelCategory
            )
            .find((eerRatio) => eerRatio.endUseType.type === params.newValue)

          params.data.endUseType = eerRatio.endUseType.type
          params.data.endUseId = eerRatio.endUseType.endUseTypeId
        }
        return true
      },
      minWidth: 400
    },
    {
      field: 'provisionOfTheAct',
      headerComponent: RequiredHeader,
      headerName: i18n.t('fuelSupply:fuelSupplyColLabels.provisionOfTheActId'),
      cellEditor: AutocompleteCellEditor,
      cellRenderer: SelectRenderer,
      valueGetter: (params) => {
        return params.data.provisionOfTheAct
      },
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
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),
      suppressKeyboardEvent,
      minWidth: 370,
      valueSetter: (params) => {
        if (params.newValue) {
          params.data.provisionOfTheAct = params.newValue
          params.data.provisionOfTheActId = optionsData?.fuelTypes
            ?.find((obj) => params.data.fuelType === obj.fuelType)
            ?.provisions.find(
              (item) => item.name === params.newValue
            )?.provisionOfTheActId

          // Handle GHGenius case
          if (params.newValue === PROVISION_GHGENIUS) {
            params.data.fuelCode = null
            params.data.fuelCodeId = null
            params.data.uci = null // Clear UCI field
            // Reset CI to default value
            const fuelType = optionsData?.fuelTypes?.find(
              (obj) => params.data.fuelType === obj.fuelType
            )
            if (fuelType) {
              if (
                params.data.fuelType === 'Other' &&
                params.data.fuelCategory
              ) {
                // For "Other" fuel types, use category default CI
                const categoryData = fuelType.fuelCategories?.find(
                  (cat) => cat.fuelCategory === params.data.fuelCategory
                )
                params.data.ciOfFuel =
                  categoryData?.defaultAndPrescribedCi || null
              } else {
                // For regular fuel types, use fuel type default CI
                params.data.ciOfFuel = fuelType.defaultCarbonIntensity || null
              }
            }
          } else if (params.newValue === PROVISION_APPROVED_FUEL_CODE) {
            params.data.fuelCode = null
            params.data.fuelCodeId = null
            // Clear CI values when switching to fuel code - they'll be set when fuel code is selected
            params.data.ciOfFuel = null
            params.data.uci = null
          } else {
            // For other provisions (like "Default carbon intensity - section 19 (b) (ii)"),
            // reset to default CI values and clear fuel code
            params.data.fuelCode = null
            params.data.fuelCodeId = null
            params.data.uci = null
            const fuelType = optionsData?.fuelTypes?.find(
              (obj) => params.data.fuelType === obj.fuelType
            )
            if (fuelType) {
              if (
                params.data.fuelType === 'Other' &&
                params.data.fuelCategory
              ) {
                // For "Other" fuel types, use category default CI
                const categoryData = fuelType.fuelCategories?.find(
                  (cat) => cat.fuelCategory === params.data.fuelCategory
                )
                params.data.ciOfFuel =
                  categoryData?.defaultAndPrescribedCi || null
              } else {
                // For regular fuel types, use fuel type default CI
                params.data.ciOfFuel = fuelType.defaultCarbonIntensity || null
              }
            }
          }
        }
        return true
      },
      editable: true,
      tooltipValueGetter: () =>
        'Act Relied Upon to Determine Carbon Intensity: Identify the appropriate provision of the Act relied upon to determine the carbon intensity of each fuel.'
    },
    {
      field: 'fuelCode',
      headerName: i18n.t('fuelSupply:fuelSupplyColLabels.fuelCode'),
      cellEditor: AutocompleteCellEditor,
      cellRenderer: SelectRenderer,
      cellEditorParams: (params) => {
        const fuelType = optionsData?.fuelTypes?.find(
          (obj) => params.data.fuelType === obj.fuelType
        )
        return {
          options: formatFuelCodeOptions(
            fuelType?.fuelCodes || [],
            compliancePeriod
          ),
          multiple: false,
          disableCloseOnSelect: false,
          freeSolo: false,
          openOnFocus: true
        }
      },
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),

      suppressKeyboardEvent,
      minWidth: 175,
      editable: (params) => {
        const fuelType = optionsData?.fuelTypes?.find(
          (obj) => params.data.fuelType === obj.fuelType
        )
        return (
          params.data.provisionOfTheAct === PROVISION_APPROVED_FUEL_CODE &&
          fuelType?.fuelCodes?.length > 0
        )
      },
      valueGetter: (params) => {
        const fuelType = optionsData?.fuelTypes?.find(
          (obj) => params.data.fuelType === obj.fuelType
        )
        if (!fuelType) {
          // If we have a fuel code, format it with country prefix for display
          if (params.data.fuelCode) {
            // Find the fuel code details to get the country
            const allFuelCodes =
              optionsData?.fuelTypes?.flatMap((ft) => ft.fuelCodes) || []
            const fuelCodeDetails = allFuelCodes.find(
              (fc) => (fc.fuelCode || fc.fuel_code) === params.data.fuelCode
            )
            const country =
              fuelCodeDetails?.fuelProductionFacilityCountry ||
              fuelCodeDetails?.fuel_production_facility_country
            return formatFuelCodeWithCountryPrefix(
              params.data.fuelCode,
              country,
              compliancePeriod
            )
          }
          return params.data.fuelCode
        }

        const isFuelCodeScenario =
          params.data.provisionOfTheAct === PROVISION_APPROVED_FUEL_CODE
        const fuelCodes =
          fuelType?.fuelCodes?.map((item) => item.fuelCode || item.fuel_code) ||
          []

        if (isFuelCodeScenario && !params.data.fuelCode) {
          // If only one code is available, auto-populate
          if (fuelCodes.length === 1) {
            const singleFuelCode = fuelType.fuelCodes[0]
            params.data.fuelCode =
              singleFuelCode.fuelCode || singleFuelCode.fuel_code
            params.data.fuelCodeId =
              singleFuelCode.fuelCodeId || singleFuelCode.fuel_code_id
          }
        }

        // Format the fuel code with country prefix for display
        if (params.data.fuelCode) {
          const fuelCodeDetails = fuelType.fuelCodes.find(
            (fc) => (fc.fuelCode || fc.fuel_code) === params.data.fuelCode
          )
          const country =
            fuelCodeDetails?.fuelProductionFacilityCountry ||
            fuelCodeDetails?.fuel_production_facility_country
          return formatFuelCodeWithCountryPrefix(
            params.data.fuelCode,
            country,
            compliancePeriod
          )
        }

        return params.data.fuelCode
      },
      valueSetter: (params) => {
        if (params.newValue) {
          // Extract the original fuel code from the formatted display value
          const originalFuelCode = extractOriginalFuelCode(params.newValue)
          params.data.fuelCode = originalFuelCode

          const fuelType = optionsData?.fuelTypes?.find(
            (obj) => params.data.fuelType === obj.fuelType
          )
          if (params.data.provisionOfTheAct === PROVISION_APPROVED_FUEL_CODE) {
            const matchingFuelCode = fuelType?.fuelCodes?.find(
              (fuelCode) => originalFuelCode === fuelCode.fuelCode
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
      }
    },
    {
      field: 'isCanadaProduced',
      headerComponent: RequiredHeader,
      headerName: i18n.t('fuelSupply:fuelSupplyColLabels.isCanadaProduced'),
      cellEditor: AutocompleteCellEditor,
      cellRenderer: SelectRenderer,
      cellEditorParams: {
        options: ['Yes', 'No'],
        multiple: false,
        disableCloseOnSelect: false,
        freeSolo: false,
        openOnFocus: true
      },
      editable: (params) => {
        const complianceYear = parseInt(compliancePeriod, 10)
        const isRenewable = !optionsData?.fuelTypes?.find(
          (obj) => params.data.fuelType === obj.fuelType
        )?.fossilDerived
        return (
          params.data.fuelCategory === 'Diesel' &&
          complianceYear >= NEW_REGULATION_YEAR &&
          isRenewable &&
          params.data.provisionOfTheAct === DEFAULT_CI_FUEL_CODE
        )
      },
      valueGetter: (params) => (params.data.isCanadaProduced ? 'Yes' : 'No'),
      valueSetter: (params) => {
        if (params.newValue) {
          params.data.isCanadaProduced = params.newValue === 'Yes'
        }
        return true
      },
      minWidth: 220
    },
    // {
    //   field: 'isQ1Supplied',
    //   headerName: i18n.t('fuelSupply:fuelSupplyColLabels.isQ1Supplied'),
    //   cellEditor: AutocompleteCellEditor,
    //   cellRenderer: SelectRenderer,
    //   cellEditorParams: {
    //     options: ['Yes', 'No'],
    //     multiple: false,
    //     disableCloseOnSelect: false,
    //     freeSolo: false,
    //     openOnFocus: true
    //   },
    //   editable: (params) => {
    //     const complianceYear = parseInt(compliancePeriod, 10)
    //     const isRenewable = !optionsData?.fuelTypes?.find(
    //       (obj) => params.data.fuelType === obj.fuelType
    //     )?.fossilDerived
    //     const fuelCode = params.data.fuelCode
    //     const isNonCanadian = fuelCode && !fuelCode.startsWith('C-')
    //     return (
    //       complianceYear >= NEW_REGULATION_YEAR && isRenewable && isNonCanadian
    //     )
    //   },
    //   hide: (params) => {
    //     const complianceYear = parseInt(compliancePeriod, 10)
    //     const isRenewable = !optionsData?.fuelTypes?.find(
    //       (obj) => params.data.fuelType === obj.fuelType
    //     )?.fossilDerived
    //     const fuelCode = params.data.fuelCode
    //     const isNonCanadian = fuelCode && !fuelCode.startsWith('C-')
    //     return !(
    //       complianceYear >= NEW_REGULATION_YEAR &&
    //       isRenewable &&
    //       isNonCanadian
    //     )
    //   },
    //   valueGetter: (params) => (params.data.isQ1Supplied ? 'Yes' : 'No'),
    //   valueSetter: (params) => {
    //     if (params.newValue) {
    //       params.data.isQ1Supplied = params.newValue === 'Yes'
    //     }
    //     return true
    //   }
    // },
    {
      field: 'quantity',
      headerComponent: RequiredHeader,
      headerName: i18n.t('fuelSupply:fuelSupplyColLabels.quantity'),
      valueFormatter: formatNumberWithCommas,
      cellEditor: NumberEditor,
      cellEditorParams: {
        precision: 0,
        min: 0,
        showStepperButtons: false
      },
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings, isSupplemental)
    },
    {
      field: 'units',
      headerName: i18n.t('fuelSupply:fuelSupplyColLabels.units'),
      minWidth: 60,
      cellEditor: AutocompleteCellEditor,
      cellEditorParams: (params) => ({
        options: ['L', 'kg', 'kWh', 'm³'],
        multiple: false,
        disableCloseOnSelect: false,
        freeSolo: false,
        openOnFocus: true
      }),
      cellRenderer: SelectRenderer,
      suppressKeyboardEvent,
      editable: (params) => isFuelTypeOther(params),
      cellStyle: (params) =>
        StandardCellStyle(
          params,
          errors,
          warnings,
          fuelTypeOtherConditionalStyle
        )
    },
    {
      field: 'targetCi',
      headerName: i18n.t('fuelSupply:fuelSupplyColLabels.targetCi'),
      editable: false,
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings, isSupplemental)
    },
    {
      field: 'ciOfFuel',
      headerName: i18n.t('fuelSupply:fuelSupplyColLabels.ciOfFuel'),
      cellEditor: NumberEditor,
      cellEditorParams: {
        precision: 2,
        min: 0,
        showStepperButtons: false
      },
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),
      editable: (params) =>
        params.data.provisionOfTheAct === PROVISION_GHGENIUS,
      valueGetter: (params) => params.data.ciOfFuel,
      valueSetter: (params) => {
        if (params.newValue !== undefined) {
          params.data.ciOfFuel = params.newValue
          return true
        }
        return false
      },
      minWidth: 100
    },
    {
      field: 'uci',
      headerName: i18n.t('fuelSupply:fuelSupplyColLabels.uci'),
      editable: false,
      minWidth: 100,
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings, isSupplemental)
    },
    {
      field: 'energyDensity',
      headerName: i18n.t('fuelSupply:fuelSupplyColLabels.energyDensity'),
      cellEditor: 'agNumberCellEditor',
      cellStyle: (params) =>
        StandardCellStyle(
          params,
          errors,
          warnings,
          fuelTypeOtherConditionalStyle
        ),
      cellEditorParams: {
        precision: 2,
        min: 0,
        showStepperButtons: false
      },
      valueGetter: (params) => {
        if (isFuelTypeOther(params)) {
          return params.data?.energyDensity
            ? params.data?.energyDensity + ' MJ/' + params.data?.units
            : 0
        } else {
          return params.data?.energyDensity
            ? params.data?.energyDensity + ' MJ/' + params.data?.units
            : ''
        }
      },
      editable: (params) => isFuelTypeOther(params)
    },
    {
      field: 'eer',
      headerName: i18n.t('fuelSupply:fuelSupplyColLabels.eer'),
      editable: false,
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings, isSupplemental)
    },
    {
      field: 'energy',
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),
      headerName: i18n.t('fuelSupply:fuelSupplyColLabels.energy'),
      valueFormatter: formatNumberWithCommas,
      minWidth: 100,
      editable: false
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
            headerName: i18n.t('fuelSupply:fuelSupplyColLabels.q1Quantity'),
            valueFormatter: formatNumberWithCommas,
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
            editable: () => {
              return isQuarterEditable(1, compliancePeriod)
            }
          },
          {
            field: 'q2Quantity',
            headerComponent: RequiredHeader,
            headerName: i18n.t('fuelSupply:fuelSupplyColLabels.q2Quantity'),
            valueFormatter: formatNumberWithCommas,
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
            editable: () => {
              return isQuarterEditable(2, compliancePeriod)
            }
          },
          {
            field: 'q3Quantity',
            headerComponent: RequiredHeader,
            headerName: i18n.t('fuelSupply:fuelSupplyColLabels.q3Quantity'),
            valueFormatter: formatNumberWithCommas,
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
            editable: () => {
              return isQuarterEditable(3, compliancePeriod)
            }
          },
          {
            field: 'q4Quantity',
            headerComponent: RequiredHeader,
            headerName: i18n.t('fuelSupply:fuelSupplyColLabels.q4Quantity'),
            valueFormatter: formatNumberWithCommas,
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
            editable: () => {
              return isQuarterEditable(4, compliancePeriod)
            }
          },
          {
            field: 'totalQuantity',
            headerName: i18n.t('fuelSupply:fuelSupplyColLabels.totalQuantity'),
            valueFormatter: formatNumberWithCommas,
            cellStyle: (params) =>
              StandardCellWarningAndErrors(
                params,
                errors,
                warnings,
                isSupplemental
              ),
            valueGetter: (params) => {
              const data = params.data
              return (
                data.q1Quantity +
                data.q2Quantity +
                data.q3Quantity +
                data.q4Quantity
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

export const fuelSupplySummaryColDef = (isEarlyIssuance, showFuelTypeOther) => {
  const baseColumns = [
    {
      headerName: i18n.t('fuelSupply:fuelSupplyColLabels.complianceUnits'),
      field: 'complianceUnits',
      valueFormatter: formatNumberWithCommas
    },
    {
      headerName: i18n.t('fuelSupply:fuelSupplyColLabels.fuelType'),
      field: 'fuelType',
      valueGetter: (params) => params.data.fuelType
    },
    {
      field: 'fuelTypeOther',
      headerName: i18n.t('fuelSupply:fuelSupplyColLabels.fuelTypeOther'),
      hide: !showFuelTypeOther
    },
    {
      headerName: i18n.t('fuelSupply:fuelSupplyColLabels.fuelCategoryId'),
      field: 'fuelCategory',
      valueGetter: (params) => params.data.fuelCategory
    },
    {
      headerName: i18n.t('fuelSupply:fuelSupplyColLabels.endUseId'),
      field: 'endUseType',
      valueGetter: (params) => params.data.endUseType
    },
    {
      headerName: i18n.t(
        'fuelSupply:fuelSupplyColLabels.determiningCarbonIntensity'
      ),
      field: 'determiningCarbonIntensity',
      valueGetter: (params) => params.data.provisionOfTheAct
    },
    {
      headerName: i18n.t('fuelSupply:fuelSupplyColLabels.fuelCode'),
      field: 'fuelCode',
      valueGetter: (params) => params.data.fuelCode
    },
    {
      headerName: i18n.t('fuelSupply:fuelSupplyColLabels.quantity'),
      field: 'quantity',
      valueFormatter: formatNumberWithCommas
    },
    {
      headerName: i18n.t('fuelSupply:fuelSupplyColLabels.units'),
      field: 'units'
    },
    {
      headerName: i18n.t('fuelSupply:fuelSupplyColLabels.targetCi'),
      field: 'targetCi'
    },
    {
      headerName: i18n.t('fuelSupply:fuelSupplyColLabels.ciOfFuel'),
      field: 'ciOfFuel'
    },
    {
      field: 'uci',
      headerName: i18n.t('fuelSupply:fuelSupplyColLabels.uci')
    },
    {
      headerName: i18n.t('fuelSupply:fuelSupplyColLabels.energyDensity'),
      field: 'energyDensity',
      valueGetter: (params) => {
        if (isFuelTypeOther(params)) {
          return params.data?.energyDensity
            ? params.data?.energyDensity + ' MJ/' + params.data?.units
            : 0
        } else {
          return params.data?.energyDensity
            ? params.data?.energyDensity + ' MJ/' + params.data?.units
            : ''
        }
      }
    },
    { headerName: i18n.t('fuelSupply:fuelSupplyColLabels.eer'), field: 'eer' },
    {
      headerName: i18n.t('fuelSupply:fuelSupplyColLabels.energy'),
      field: 'energy',
      valueFormatter: formatNumberWithCommas
    }
  ]

  if (isEarlyIssuance) {
    return baseColumns.flatMap((item) => {
      if (item.field === 'quantity') {
        return [
          {
            field: 'q1Quantity',
            headerName: i18n.t('fuelSupply:fuelSupplyColLabels.q1Quantity'),
            valueFormatter: formatNumberWithCommas
          },
          {
            field: 'q2Quantity',
            headerName: i18n.t('fuelSupply:fuelSupplyColLabels.q2Quantity'),
            valueFormatter: formatNumberWithCommas
          },
          {
            field: 'q3Quantity',
            headerName: i18n.t('fuelSupply:fuelSupplyColLabels.q3Quantity'),
            valueFormatter: formatNumberWithCommas
          },
          {
            field: 'q4Quantity',
            headerName: i18n.t('fuelSupply:fuelSupplyColLabels.q4Quantity'),
            valueFormatter: formatNumberWithCommas
          },
          {
            field: 'totalQuantity',
            headerName: i18n.t('fuelSupply:fuelSupplyColLabels.totalQuantity'),
            valueFormatter: formatNumberWithCommas,
            valueGetter: (params) => {
              const data = params.data
              return (
                data.q1Quantity +
                data.q2Quantity +
                data.q3Quantity +
                data.q4Quantity
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
  singleClickEdit: true
}

export const changelogCommonColDefs = (highlight = true) => [
  {
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.complianceUnits'),
    field: 'complianceUnits',
    valueFormatter: formatNumberWithCommas,
    cellStyle: (params) =>
      highlight && changelogCellStyle(params, 'complianceUnits')
  },
  {
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.fuelType'),
    field: 'fuelType.fuelType',
    cellStyle: (params) => highlight && changelogCellStyle(params, 'fuelType')
  },
  {
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.fuelCategoryId'),
    field: 'fuelCategory.category',
    cellStyle: (params) =>
      highlight && changelogCellStyle(params, 'fuelCategory')
  },
  {
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.endUseId'),
    field: 'endUseType.type',
    cellStyle: (params) => highlight && changelogCellStyle(params, 'endUseType')
  },
  {
    headerName: i18n.t(
      'fuelSupply:fuelSupplyColLabels.determiningCarbonIntensity'
    ),
    field: 'provisionOfTheAct.name',
    cellStyle: (params) =>
      highlight && changelogCellStyle(params, 'provisionOfTheAct')
  },
  {
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.fuelCode'),
    field: 'fuelCode.fuelCode',
    cellStyle: (params) => highlight && changelogCellStyle(params, 'fuelCode')
  },
  {
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.quantity'),
    field: 'quantity',
    valueFormatter: formatNumberWithCommas,
    cellStyle: (params) => highlight && changelogCellStyle(params, 'quantity')
  },
  {
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.units'),
    field: 'units',
    cellStyle: (params) => highlight && changelogCellStyle(params, 'units')
  },
  {
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.targetCi'),
    field: 'targetCi',
    cellStyle: (params) => highlight && changelogCellStyle(params, 'targetCi')
  },
  {
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.ciOfFuel'),
    field: 'ciOfFuel',
    cellStyle: (params) => highlight && changelogCellStyle(params, 'ciOfFuel')
  },
  {
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.uci'),
    field: 'uci',
    cellStyle: (params) => highlight && changelogCellStyle(params, 'uci')
  },
  {
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.energyDensity'),
    field: 'energyDensity',
    cellStyle: (params) =>
      highlight && changelogCellStyle(params, 'energyDensity')
  },
  {
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.eer'),
    field: 'eer',
    cellStyle: (params) => highlight && changelogCellStyle(params, 'eer')
  },
  {
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.energy'),
    field: 'energy',
    valueFormatter: formatNumberWithCommas,
    cellStyle: (params) => highlight && changelogCellStyle(params, 'energy')
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
  overlayNoRowsTemplate: i18n.t('fuelSupply:noFuelSuppliesFound'),
  autoSizeStrategy: {
    type: 'fitCellContents',
    defaultMinWidth: 50,
    defaultMaxWidth: 600
  },
  enableCellTextSelection: true, // enables text selection on the grid
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
