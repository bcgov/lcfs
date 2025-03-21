import { actions, validation } from '@/components/BCDataGrid/columns'
import {
  AsyncSuggestionEditor,
  AutocompleteCellEditor,
  DateEditor,
  NumberEditor,
  RequiredHeader
} from '@/components/BCDataGrid/components'
import BCTypography from '@/components/BCTypography'
import { apiRoutes } from '@/constants/routes'
import i18n from '@/i18n'
import colors from '@/themes/base/colors'
import { formatNumberWithCommas as valueFormatter } from '@/utils/formatters'
import {
  fuelTypeOtherConditionalStyle,
  isFuelTypeOther
} from '@/utils/fuelTypeOther'
import { changelogCellStyle } from '@/utils/grid/changelogCellStyle'
import {
  StandardCellStyle,
  StandardCellWarningAndErrors
} from '@/utils/grid/errorRenderers'
import { suppressKeyboardEvent } from '@/utils/grid/eventHandlers'
import { SelectRenderer } from '@/utils/grid/cellRenderers.jsx'
import { ACTION_STATUS_MAP } from '@/constants/schemaConstants'

export const PROVISION_APPROVED_FUEL_CODE = 'Fuel code - section 19 (b) (i)'

export const fuelExportColDefs = (
  optionsData,
  errors,
  warnings,
  gridReady,
  isSupplemental
) => [
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
    headerName: i18n.t('fuelExport:fuelExportColLabels.complianceReportId'),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    hide: true
  },
  {
    field: 'fuelExportId',
    headerName: i18n.t('fuelExport:fuelExportColLabels.fuelExportId'),
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
    headerName: i18n.t('fuelExport:fuelExportColLabels.complianceUnits'),
    minWidth: 100,
    valueFormatter,
    editable: false,
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings, isSupplemental)
  },
  {
    field: 'fuelTypeId',
    headerComponent: RequiredHeader,
    headerName: i18n.t('fuelExport:fuelExportColLabels.fuelTypeId'),
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
        params.data.fuelTypeOther = undefined
        params.data.fuelCategory = undefined
        params.data.fuelCategoryId = undefined
        params.data.endUseId = undefined
        params.data.endUseType = undefined
        params.data.eer = undefined
        params.data.provisionOfTheAct = undefined
        params.data.provisionOfTheActId = undefined
        params.data.fuelCode = undefined
        params.data.units = fuelType?.unit
      }
      return true
    },
    tooltipValueGetter: (p) => 'Select the fuel type from the list'
  },
  {
    field: 'fuelTypeOther',
    headerName: i18n.t('fuelExport:fuelExportColLabels.fuelTypeOther'),
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
    cellStyle: (params) => {
      if (isSupplemental && params.data.isNewSupplementalEntry) {
        if (params.data.actionType === 'UPDATE') {
          return { backgroundColor: colors.alerts.warning.background }
        }
      } else {
        return StandardCellStyle(
          params,
          errors,
          null,
          fuelTypeOtherConditionalStyle
        )
      }
    },
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
    headerName: i18n.t('fuelExport:fuelExportColLabels.fuelCategory'),
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
        params.data.endUseId = undefined
        params.data.endUseType = undefined
        params.data.eer = undefined
        params.data.provisionOfTheAct = undefined
        params.data.fuelCode = undefined
      }
      return true
    },
    suppressKeyboardEvent,
    minWidth: 135,
    valueGetter: (params) => {
      return params.data.fuelCategory
    },
    editable: (params) =>
      optionsData?.fuelTypes
        ?.find((obj) => params.data.fuelType === obj.fuelType)
        ?.fuelCategories.map((item) => item.fuelCategory).length > 1,
    tooltipValueGetter: (p) => 'Select the fuel category from the list'
  },
  {
    field: 'endUseType',
    headerComponent: RequiredHeader,
    headerName: i18n.t('fuelExport:fuelExportColLabels.endUseId'),
    options: (params) =>
      [
        ...new Set(
          optionsData?.fuelTypes
            ?.find((obj) => params.data.fuelType === obj.fuelType)
            ?.eerRatios.filter(
              (item) =>
                item.fuelCategory.fuelCategory === params.data.fuelCategory
            )
            ?.map((item) => item.endUseType?.type)
            .sort()
        )
      ].filter((item) => item != null),
    cellEditorParams: (params) => ({
      options: params.colDef.options(params),
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
    valueGetter: (params) => {
      return params.data.endUseType?.type
    },
    editable: (params) => {
      const cellParams = params.colDef?.cellEditorParams(params)
      return cellParams.options.length > 1
    },
    valueSetter: (params) => {
      if (params.newValue) {
        const selectedFuel = optionsData?.fuelTypes?.find(
          (obj) => params.data.fuelType === obj.fuelType
        )
        const eerOptions = selectedFuel?.eerRatios.filter(
          (item) => item.fuelCategory.fuelCategory === params.data.fuelCategory
        )
        const selectedRatio = eerOptions.find(
          (eerRatio) => eerRatio.endUseType.type === params.newValue
        )
        if (selectedRatio) {
          params.data.endUseType = selectedRatio.endUseType
          params.data.endUseId = selectedRatio.endUseType.endUseTypeId
        }
      }
      return true
    },
    minWidth: 400
  },
  {
    field: 'provisionOfTheAct',
    headerComponent: RequiredHeader,
    headerName: i18n.t('fuelExport:fuelExportColLabels.provisionOfTheActId'),
    cellEditor: AutocompleteCellEditor,
    cellRenderer: SelectRenderer,
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

        if (params.newValue !== PROVISION_APPROVED_FUEL_CODE) {
          params.data.fuelCode = null;
          params.data.fuelCodeId = null;
        }
      }
      return true
    },
    editable: (params) => {
      const cellParams = params.colDef?.cellEditorParams(params)
      return cellParams.options?.length > 1
    },
    tooltipValueGetter: (p) =>
      'Act Relied Upon to Determine Carbon Intensity: Identify the appropriate provision of the Act relied upon to determine the carbon intensity of each fuel.'
  },
  {
    field: 'fuelCode',
    headerName: i18n.t('fuelExport:fuelExportColLabels.fuelCode'),
    cellEditor: AutocompleteCellEditor,
    suppressKeyboardEvent,
    minWidth: 135,
    cellEditorParams: (params) => {
      const fuelTypeObj = optionsData?.fuelTypes?.find(
        (obj) => params.data.fuelType === obj.fuelType
      )
      return {
        options: fuelTypeObj?.fuelCodes?.map((item) => item.fuelCode) || [],
        multiple: false,
        disableCloseOnSelect: false,
        freeSolo: false,
        openOnFocus: true
      }
    },
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),

    editable: (params) => {
      if (params.data.provisionOfTheAct === 'Unknown') return false

      const fuelTypeObj = optionsData?.fuelTypes?.find(
        (obj) => params.data.fuelType === obj.fuelType
      )
      const fuelCodes = fuelTypeObj?.fuelCodes || []
      return (
        fuelCodes.length > 0 &&
        params.data.provisionOfTheAct === PROVISION_APPROVED_FUEL_CODE
      )
    },
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
      const newCode = params.newValue
      const fuelTypeObj = optionsData?.fuelTypes?.find(
        (obj) => params.data.fuelType === obj.fuelType
      )
      const selectedFuelCodeObj = fuelTypeObj?.fuelCodes.find(
        (item) => item.fuelCode === newCode
      )

      if (selectedFuelCodeObj) {
        params.data.fuelCode = selectedFuelCodeObj.fuelCode
        params.data.fuelCodeId = selectedFuelCodeObj.fuelCodeId
      } else {
        params.data.fuelCode = undefined
        params.data.fuelCodeId = undefined
      }

      return true
    }
  },
  {
    field: 'exportDate',
    headerName: i18n.t('fuelExport:fuelExportColLabels.exportDate'),
    maxWidth: 220,
    minWidth: 200,
    cellRenderer: (params) => (
      <BCTypography variant="body4">
        {params.value ? params.value : 'YYYY-MM-DD'}
      </BCTypography>
    ),
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),

    suppressKeyboardEvent,
    cellEditor: DateEditor,

    editable: (params) => {
      return !!params.data.provisionOfTheAct
    },

    cellEditorParams: {
      autoOpenLastRow: !gridReady
    }
  },
  {
    field: 'quantity',
    headerComponent: RequiredHeader,
    headerName: i18n.t('fuelExport:fuelExportColLabels.quantity'),
    minWidth: 200,
    valueFormatter,
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
    headerName: i18n.t('fuelExport:fuelExportColLabels.units'),
    minWidth: 100,
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
    cellStyle: (params) => {
      if (isSupplemental && params.data.isNewSupplementalEntry) {
        if (params.data.actionType === 'UPDATE') {
          return { backgroundColor: colors.alerts.warning.background }
        }
      } else {
        return StandardCellStyle(
          params,
          errors,
          null,
          fuelTypeOtherConditionalStyle
        )
      }
    }
  },
  {
    field: 'targetCi',
    headerName: i18n.t('fuelExport:fuelExportColLabels.targetCI'),
    editable: false,
    minWidth: 100,
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),

    valueGetter: (params) =>
      optionsData?.fuelTypes
        ?.find((obj) => params.data.fuelType === obj.fuelType)
        ?.targetCarbonIntensities.find(
          (item) => item.fuelCategory.fuelCategory === params.data.fuelCategory
        )?.targetCarbonIntensity || 0
  },
  {
    field: 'ciOfFuel',
    headerName: i18n.t('fuelExport:fuelExportColLabels.ciOfFuel'),
    editable: false,
    minWidth: 100,
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),

    valueGetter: (params) => {
      if (params.data.provisionOfTheAct === 'Unknown') {
        const exportDateValue = params.data.exportDate
        if (!exportDateValue) {
          return 0
        }
        const exportDateObj = new Date(exportDateValue)
        if (Number.isNaN(exportDateObj.getTime())) {
          return 0
        }
        const fuelTypeObj = optionsData?.fuelTypes?.find(
          (obj) => obj.fuelType === params.data.fuelType
        )
        if (!fuelTypeObj) return 0

        const twelveMonthsAgo = new Date(exportDateObj)
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

        const validCodes = (fuelTypeObj.fuelCodes || []).filter((fc) => {
          const fcDate = new Date(fc.fuelCodeEffectiveDate)
          return fcDate >= twelveMonthsAgo && fcDate <= exportDateObj
        })
        if (!validCodes.length) {
          return 0
        }
        const minCI = Math.min(
          ...validCodes.map((fc) => fc.fuelCodeCarbonIntensity)
        )
        return minCI
      }
      
      if (/Fuel code/i.test(params.data.provisionOfTheAct)) {
        return optionsData?.fuelTypes
          ?.find((obj) => params.data.fuelType === obj.fuelType)
          ?.fuelCodes.find((item) => item.fuelCode === params.data.fuelCode)
          ?.fuelCodeCarbonIntensity
      } else {
        if (optionsData) {
          if (isFuelTypeOther(params) && params.data.fuelCategory) {
            const categories = optionsData?.fuelTypes?.find(
              (obj) => params.data.fuelType === obj.fuelType
            ).fuelCategories
            const defaultCI = categories.find(
              (cat) => cat.fuelCategory === params.data.fuelCategory
            ).defaultAndPrescribedCi

            return defaultCI
          }
        }
        return (
          (optionsData &&
            optionsData?.fuelTypes?.find(
              (obj) => params.data.fuelType === obj.fuelType
            )?.defaultCarbonIntensity) ||
          0
        )
      }
    }
  },
  {
    field: 'uci',
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.uci'),
    editable: false,
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),

    minWidth: 100
  },
  {
    field: 'energyDensity',
    headerName: i18n.t('fuelExport:fuelExportColLabels.energyDensity'),
    cellEditor: 'agNumberCellEditor',
    minWidth: 200,
    cellStyle: (params) => {
      if (isSupplemental && params.data.isNewSupplementalEntry) {
        if (params.data.actionType === 'UPDATE') {
          return { backgroundColor: colors.alerts.warning.background }
        }
      } else {
        return StandardCellStyle(
          params,
          errors,
          null,
          fuelTypeOtherConditionalStyle
        )
      }
    },
    cellEditorParams: {
      precision: 2,
      min: 0,
      showStepperButtons: false
    },
    valueGetter: (params) => {
      if (isFuelTypeOther(params)) {
        return params.data?.energyDensity + ' MJ/' + params.data?.units || 0
      } else {
        const ed = optionsData?.fuelTypes?.find(
          (obj) => params.data.fuelType === obj.fuelType
        )?.energyDensity
        return (ed && ed.energyDensity + ' MJ/' + params.data.units) || 0
      }
    },
    editable: (params) => isFuelTypeOther(params)
  },
  {
    field: 'eer',
    headerName: i18n.t('fuelExport:fuelExportColLabels.eer'),
    editable: false,
    minWidth: 100,
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),

    valueGetter: (params) => {
      const eerOptions = optionsData?.fuelTypes?.find(
        (obj) => params.data.fuelType === obj.fuelType
      )
      let eer =
        eerOptions &&
        eerOptions?.eerRatios.find(
          (item) =>
            item.fuelCategory.fuelCategory === params.data.fuelCategory &&
            item.endUseType?.type === params.data.endUseType?.type
        )
      if (!eer) {
        eer = eerOptions?.eerRatios?.find(
          (item) =>
            item.fuelCategory.fuelCategory === params.data.fuelCategory &&
            item.endUseType === null
        )
      }
      return eer?.energyEffectivenessRatio || 0
    }
  },
  {
    field: 'energy',
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),

    headerName: i18n.t('fuelExport:fuelExportColLabels.energy'),
    valueFormatter,
    minWidth: 100,
    editable: false
  }
]

export const fuelExportSummaryColDefs = [
  {
    headerName: i18n.t('fuelExport:fuelExportColLabels.complianceUnits'),
    field: 'complianceUnits',
    valueFormatter
  },
  {
    headerName: i18n.t('fuelExport:fuelExportColLabels.exportDate'),
    field: 'exportDate'
  },
  {
    headerName: i18n.t('fuelExport:fuelExportColLabels.fuelTypeId'),
    field: 'fuelType',
    valueGetter: (params) => params.data.fuelType?.fuelType
  },
  {
    headerName: i18n.t('fuelExport:fuelExportColLabels.fuelCategoryId'),
    field: 'fuelCategory',
    valueGetter: (params) => params.data.fuelCategory?.category
  },
  {
    headerName: i18n.t('fuelExport:fuelExportColLabels.endUseId'),
    field: 'endUseType',
    valueGetter: (params) => params.data.endUseType?.type || 'Any'
  },
  {
    headerName: i18n.t(
      'fuelExport:fuelExportColLabels.determiningCarbonIntensity'
    ),
    field: 'determiningCarbonIntensity',
    valueGetter: (params) => params.data.provisionOfTheAct?.name
  },
  {
    headerName: i18n.t('fuelExport:fuelExportColLabels.fuelCode'),
    field: 'fuelCode',
    valueGetter: (params) => params.data.fuelCode?.fuelCode
  },
  {
    headerName: i18n.t('fuelExport:fuelExportColLabels.quantity'),
    field: 'quantity',
    valueFormatter
  },
  {
    headerName: i18n.t('fuelExport:fuelExportColLabels.units'),
    field: 'units'
  },
  {
    headerName: i18n.t('fuelExport:fuelExportColLabels.targetCI'),
    field: 'targetCi'
  },
  {
    headerName: i18n.t('fuelExport:fuelExportColLabels.ciOfFuel'),
    field: 'ciOfFuel'
  },
  {
    field: 'uci',
    headerName: i18n.t('fuelExport:fuelExportColLabels.uci')
  },
  {
    headerName: i18n.t('fuelExport:fuelExportColLabels.energyDensity'),
    field: 'energyDensity'
  },
  { headerName: i18n.t('fuelExport:fuelExportColLabels.eer'), field: 'eer' },
  {
    headerName: i18n.t('fuelExport:fuelExportColLabels.energy'),
    field: 'energy',
    valueFormatter
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

export const changelogCommonColDefs = [
  {
    headerName: i18n.t('fuelExport:fuelExportColLabels.complianceUnits'),
    field: 'complianceUnits',
    valueFormatter,
    cellStyle: (params) => changelogCellStyle(params, 'complianceUnits')
  },
  {
    headerName: i18n.t('fuelExport:fuelExportColLabels.exportDate'),
    field: 'exportDate',
    cellStyle: (params) => changelogCellStyle(params, 'exportDate')
  },
  {
    headerName: i18n.t('fuelExport:fuelExportColLabels.fuelTypeId'),
    field: 'fuelType',
    valueGetter: (params) => params.data.fuelType?.fuelType,
    cellStyle: (params) => changelogCellStyle(params, 'fuelTypeId')
  },
  {
    headerName: i18n.t('fuelExport:fuelExportColLabels.fuelCategoryId'),
    field: 'fuelCategory',
    valueGetter: (params) => params.data.fuelCategory?.category,
    cellStyle: (params) => changelogCellStyle(params, 'fuelCategoryId')
  },
  {
    headerName: i18n.t('fuelExport:fuelExportColLabels.endUseId'),
    field: 'endUseType',
    valueGetter: (params) => params.data.endUseType?.type,
    cellStyle: (params) => changelogCellStyle(params, 'endUseId')
  },
  {
    headerName: i18n.t(
      'fuelExport:fuelExportColLabels.determiningCarbonIntensity'
    ),
    field: 'determiningCarbonIntensity',
    valueGetter: (params) => params.data.provisionOfTheAct?.name,
    cellStyle: (params) => changelogCellStyle(params, 'provisionOfTheActId')
  },
  {
    headerName: i18n.t('fuelExport:fuelExportColLabels.fuelCode'),
    field: 'fuelCode',
    valueGetter: (params) => params.data.fuelCode?.fuelCode,
    cellStyle: (params) => changelogCellStyle(params, 'fuelCodeId')
  },
  {
    headerName: i18n.t('fuelExport:fuelExportColLabels.quantity'),
    field: 'quantity',
    valueFormatter,
    cellStyle: (params) => changelogCellStyle(params, 'quantity')
  },
  {
    headerName: i18n.t('fuelExport:fuelExportColLabels.units'),
    field: 'units',
    cellStyle: (params) => changelogCellStyle(params, 'units')
  },
  {
    headerName: i18n.t('fuelExport:fuelExportColLabels.targetCI'),
    field: 'targetCi',
    cellStyle: (params) => changelogCellStyle(params, 'targetCi')
  },
  {
    headerName: i18n.t('fuelExport:fuelExportColLabels.ciOfFuel'),
    field: 'ciOfFuel',
    cellStyle: (params) => changelogCellStyle(params, 'ciOfFuel')
  },
  {
    headerName: i18n.t('fuelExport:fuelExportColLabels.uci'),
    field: 'uci',

    cellStyle: (params) => changelogCellStyle(params, 'uci')
  },
  {
    headerName: i18n.t('fuelExport:fuelExportColLabels.energyDensity'),
    field: 'energyDensity',
    cellStyle: (params) => changelogCellStyle(params, 'energyDensity')
  },
  {
    headerName: i18n.t('fuelExport:fuelExportColLabels.eer'),
    field: 'eer',
    cellStyle: (params) => changelogCellStyle(params, 'eer')
  },
  {
    headerName: i18n.t('fuelExport:fuelExportColLabels.energy'),
    field: 'energy',
    valueFormatter,
    cellStyle: (params) => changelogCellStyle(params, 'energy')
  }
]

export const changelogColDefs = [
  {
    field: 'groupUuid',
    hide: true,
    sort: 'desc',
    sortIndex: 1
  },
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
      if (params.data.actionType === 'UPDATE') {
        return { backgroundColor: colors.alerts.warning.background }
      }
    }
  },
  ...changelogCommonColDefs
]

export const changelogDefaultColDefs = {
  floatingFilter: false,
  filter: false
}

export const changelogCommonGridOptions = {
  overlayNoRowsTemplate: i18n.t('fuelExport:noFuelExportsFound'),
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
