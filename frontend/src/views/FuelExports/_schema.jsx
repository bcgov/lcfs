import { suppressKeyboardEvent } from '@/utils/grid/eventHandlers'
import BCTypography from '@/components/BCTypography'
import {
  AutocompleteCellEditor,
  NumberEditor,
  RequiredHeader,
  DateEditor,
  AsyncSuggestionEditor
} from '@/components/BCDataGrid/components'
import i18n from '@/i18n'
import { actions, validation } from '@/components/BCDataGrid/columns'
import { formatNumberWithCommas as valueFormatter } from '@/utils/formatters'
import { apiRoutes } from '@/constants/routes'
import {
  StandardCellStyle,
  StandardCellWarningAndErrors
} from '@/utils/grid/errorRenderers'
import {
  isFuelTypeOther,
  fuelTypeOtherConditionalStyle
} from '@/utils/fuelTypeOther'

export const PROVISION_APPROVED_FUEL_CODE = 'Fuel code - section 19 (b) (i)'

const cellErrorStyle = (params, errors) => {
  let style = {}
  if (
    errors &&
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

export const fuelExportColDefs = (optionsData, errors, warnings, gridReady) => [
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
      StandardCellWarningAndErrors(params, errors, warnings)
  },
  {
    field: 'exportDate',
    headerName: i18n.t('fuelExport:fuelExportColLabels.exportDate'),
    headerComponent: RequiredHeader,
    maxWidth: 220,
    minWidth: 200,
    cellRenderer: (params) => (
      <BCTypography variant="body4">
        {params.value ? params.value : 'YYYY-MM-DD'}
      </BCTypography>
    ),
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
    suppressKeyboardEvent,
    cellEditor: DateEditor,
    cellEditorPopup: true,
    cellEditorParams: {
      autoOpenLastRow: !gridReady
    }
  },
  {
    field: 'fuelTypeId',
    headerComponent: RequiredHeader,
    headerName: i18n.t('fuelExport:fuelExportColLabels.fuelTypeId'),
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
    field: 'fuelCategoryId',
    headerComponent: RequiredHeader,
    headerName: i18n.t('fuelExport:fuelExportColLabels.fuelCategoryId'),
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
      const options = optionsData?.fuelTypes
        ?.find((obj) => params.data.fuelType === obj.fuelType)
        ?.fuelCategories.map((item) => item.fuelCategory)
      if (options?.length === 1) {
        return options[0]
      } else {
        return params.data.fuelCategory
      }
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
      ].filter((item) => item != null) || ['Any'],
    cellEditorParams: (params) => ({
      options: params.colDef.options(params),
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
    valueGetter: (params) => {
      return params.colDef?.cellEditorParams(params).options.length < 1
        ? 'Any'
        : params.data?.endUseType?.type
    },
    editable: (params) => params.colDef?.options(params).length > 0,
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
    headerName: i18n.t('fuelExport:fuelExportColLabels.provisionOfTheActId'),
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
        params.data.fuelCode = undefined
      }
      return true
    },
    editable: true,
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
    cellStyle: (params) => {
      const style = cellErrorStyle(params, errors)
      const fuelTypeObj = optionsData?.fuelTypes?.find(
        (obj) => params.data.fuelType === obj.fuelType
      )
      const fuelCodes =
        fuelTypeObj?.fuelCodes.map((item) => item.fuelCode) || []
      const isFuelCodeScenario =
        params.data.provisionOfTheAct === PROVISION_APPROVED_FUEL_CODE

      // Check if fuel code is required (scenario) but missing
      const fuelCodeRequiredAndMissing =
        isFuelCodeScenario && !params.data.fuelCode

      if (fuelCodeRequiredAndMissing) {
        // Required scenario but missing a fuel code
        style.borderColor = 'red'
        style.backgroundColor = '#fff'
      } else if (isFuelCodeScenario && fuelCodes.length > 1) {
        style.backgroundColor = '#fff'
        style.borderColor = 'unset'
      } else if (isFuelCodeScenario && fuelCodes.length > 0) {
        style.backgroundColor = '#fff'
        style.borderColor = 'unset'
      } else {
        style.backgroundColor = '#f2f2f2'
      }

      return style
    },
    editable: (params) => {
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
      StandardCellWarningAndErrors(params, errors, warnings)
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
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <BCTypography variant="body4">Select</BCTypography>),
    suppressKeyboardEvent,
    editable: (params) => isFuelTypeOther(params),
    cellStyle: (params) => {
      StandardCellStyle(params, errors, null, fuelTypeOtherConditionalStyle)
    }
  },
  {
    field: 'targetCi',
    headerName: i18n.t('fuelExport:fuelExportColLabels.targetCI'),
    editable: false,
    minWidth: 100,
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
    headerName: i18n.t('fuelExport:fuelExportColLabels.ciOfFuel'),
    editable: false,
    minWidth: 100,
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
    valueGetter: (params) => {
      if (/Fuel code/i.test(params.data.determiningCarbonIntensity)) {
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
      StandardCellWarningAndErrors(params, errors, warnings),
    minWidth: 100
  },
  {
    field: 'energyDensity',
    headerName: i18n.t('fuelExport:fuelExportColLabels.energyDensity'),
    cellEditor: 'agNumberCellEditor',
    minWidth: 200,
    cellStyle: (params) => {
      StandardCellStyle(params, errors, null, fuelTypeOtherConditionalStyle)
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
    headerName: i18n.t('fuelExport:fuelExportColLabels.energy'),
    valueFormatter,
    minWidth: 100,
    editable: false
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
