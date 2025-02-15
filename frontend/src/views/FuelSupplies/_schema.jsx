import { suppressKeyboardEvent } from '@/utils/grid/eventHandlers'
import BCTypography from '@/components/BCTypography'
import {
  AsyncSuggestionEditor,
  AutocompleteCellEditor,
  NumberEditor,
  RequiredHeader
} from '@/components/BCDataGrid/components'
import i18n from '@/i18n'
import { actions, validation } from '@/components/BCDataGrid/columns'
import { formatNumberWithCommas as valueFormatter } from '@/utils/formatters'
import {
  fuelTypeOtherConditionalStyle,
  isFuelTypeOther
} from '@/utils/fuelTypeOther'
import {
  StandardCellStyle,
  StandardCellWarningAndErrors
} from '@/utils/grid/errorRenderers'
import { apiRoutes } from '@/constants/routes'

export const PROVISION_APPROVED_FUEL_CODE = 'Fuel code - section 19 (b) (i)'

export const fuelSupplyColDefs = (optionsData, errors, warnings) => [
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
    valueFormatter,
    editable: false,
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings)
  },
  {
    field: 'fuelType',
    headerComponent: RequiredHeader,
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.fuelType'),
    cellEditor: AutocompleteCellEditor,
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <BCTypography variant="body4">Select</BCTypography>),
    cellEditorParams: {
      options: optionsData?.fuelTypes?.map((obj) => obj.fuelType).sort(),
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    },
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
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
    editable: (params) => isFuelTypeOther(params),
    minWidth: 250
  },
  {
    field: 'fuelCategory',
    headerComponent: RequiredHeader,
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.fuelCategoryId'),
    cellEditor: AutocompleteCellEditor,
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <BCTypography variant="body4">Select</BCTypography>),
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
      StandardCellWarningAndErrors(params, errors, warnings),
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
            ?.map((item) => item.endUseType?.type)
            .sort()
        )
      ].filter((item) => item != null),
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    }),
    cellEditor: AutocompleteCellEditor,
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <BCTypography variant="body4">Select</BCTypography>),
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
    suppressKeyboardEvent,
    valueGetter: (params) => params.data.endUseType?.type,
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

        params.data.endUseType = eerRatio.endUseType
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
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <BCTypography variant="body4">Select</BCTypography>),
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
      StandardCellWarningAndErrors(params, errors, warnings),
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
        params.data.fuelCode = null
        params.data.fuelCodeId = null
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
    minWidth: 135,
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
      if (!fuelType) return params.data.fuelCode

      const isFuelCodeScenario =
        params.data.provisionOfTheAct === PROVISION_APPROVED_FUEL_CODE
      const fuelCodes = fuelType?.fuelCodes?.map((item) => item.fuelCode) || []

      if (isFuelCodeScenario && !params.data.fuelCode) {
        // If only one code is available, auto-populate
        if (fuelCodes.length === 1) {
          const singleFuelCode = fuelType.fuelCodes[0]
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
    }
  },
  {
    field: 'quantity',
    headerComponent: RequiredHeader,
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.quantity'),
    valueFormatter: (params) => valueFormatter({ value: params.value }),
    cellEditor: NumberEditor,
    cellEditorParams: {
      precision: 0,
      min: 0,
      showStepperButtons: false
    },
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings)
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
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <BCTypography variant="body4">Select</BCTypography>),
    suppressKeyboardEvent,
    editable: (params) => isFuelTypeOther(params),
    cellStyle: (params) =>
      StandardCellStyle(params, errors, warnings, fuelTypeOtherConditionalStyle)
  },
  {
    field: 'targetCi',
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.targetCi'),
    editable: false,
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
    valueGetter: (params) =>
      optionsData?.fuelTypes
        ?.find((obj) => params.data.fuelType === obj.fuelType)
        ?.targetCarbonIntensities.find(
          (item) => item.fuelCategory.fuelCategory === params.data.fuelCategory
        )?.targetCarbonIntensity || 0
  },
  {
    field: 'ciOfFuel',
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.ciOfFuel'),
    editable: false,
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings)
  },
  {
    field: 'uci',
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.uci'),
    editable: false,
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings)
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
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.eer'),
    editable: false,
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
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
      StandardCellWarningAndErrors(params, errors, warnings),
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.energy'),
    valueFormatter,
    minWidth: 100,
    editable: false
  }
]

export const fuelSupplySummaryColDef = (t) => [
  {
    headerName: t('fuelSupply:fuelSupplyColLabels.complianceUnits'),
    field: 'complianceUnits',
    valueFormatter
  },
  {
    headerName: t('fuelSupply:fuelSupplyColLabels.fuelType'),
    field: 'fuelType',
    valueGetter: (params) => params.data.fuelType?.fuelType
  },
  {
    headerName: t('fuelSupply:fuelSupplyColLabels.fuelCategoryId'),
    field: 'fuelCategory',
    valueGetter: (params) => params.data.fuelCategory?.category
  },
  {
    headerName: t('fuelSupply:fuelSupplyColLabels.endUseId'),
    field: 'endUse',
    valueGetter: (params) => params.data.endUseType?.type || 'Any'
  },
  {
    headerName: t('fuelSupply:fuelSupplyColLabels.determiningCarbonIntensity'),
    field: 'determiningCarbonIntensity',
    valueGetter: (params) => params.data.provisionOfTheAct?.name
  },
  {
    headerName: t('fuelSupply:fuelSupplyColLabels.fuelCode'),
    field: 'fuelCode',
    valueGetter: (params) => params.data.fuelCode?.fuelCode
  },
  {
    headerName: t('fuelSupply:fuelSupplyColLabels.quantity'),
    field: 'quantity',
    valueFormatter
  },
  { headerName: t('fuelSupply:fuelSupplyColLabels.units'), field: 'units' },
  {
    headerName: t('fuelSupply:fuelSupplyColLabels.targetCi'),
    field: 'targetCi'
  },
  {
    headerName: t('fuelSupply:fuelSupplyColLabels.ciOfFuel'),
    field: 'ciOfFuel'
  },
  {
    field: 'uci',
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.uci')
  },
  {
    headerName: t('fuelSupply:fuelSupplyColLabels.energyDensity'),
    field: 'energyDensity'
  },
  { headerName: t('fuelSupply:fuelSupplyColLabels.eer'), field: 'eer' },
  {
    headerName: t('fuelSupply:fuelSupplyColLabels.energy'),
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
