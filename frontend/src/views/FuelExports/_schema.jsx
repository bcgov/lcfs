import { suppressKeyboardEvent } from '@/utils/grid/eventHandlers'
import { Typography } from '@mui/material'
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
import { StandardCellStyle } from '@/utils/grid/errorRenderers'
import {
  isFuelTypeOther,
  fuelTypeOtherConditionalStyle
} from '@/utils/fuelTypeOther'

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

export const fuelExportColDefs = (optionsData, errors) => [
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
    cellStyle: (params) => cellErrorStyle(params, errors)
  },
  {
    field: 'exportDate',
    headerName: i18n.t('fuelExport:fuelExportColLabels.exportDate'),
    headerComponent: RequiredHeader,
    maxWidth: 220,
    minWidth: 200,
    cellRenderer: (params) => (
      <Typography variant="body4">
        {params.value ? params.value : 'YYYY-MM-DD'}
      </Typography>
    ),
    suppressKeyboardEvent,
    cellEditor: DateEditor,
    cellEditorPopup: true
  },
  {
    field: 'fuelType',
    headerComponent: RequiredHeader,
    headerName: i18n.t('fuelExport:fuelExportColLabels.fuelType'),
    cellEditor: AutocompleteCellEditor,
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>),
    cellEditorParams: {
      options: optionsData?.fuelTypes?.map((obj) => obj.fuelType).sort(),
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    },
    cellStyle: (params) => cellErrorStyle(params, errors),
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
        params.data.endUseId = undefined
        params.data.endUseType = undefined
        params.data.eer = undefined
        params.data.provisionOfTheAct = undefined
        params.data.fuelCode = undefined
        params.data.quantity = 0
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
    field: 'fuelCategory',
    headerComponent: RequiredHeader,
    headerName: i18n.t('fuelExport:fuelExportColLabels.fuelCategory'),
    cellEditor: AutocompleteCellEditor,
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>),
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
    cellStyle: (params) => cellErrorStyle(params, errors),
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
        params.data.quantity = 0
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
    headerName: i18n.t('fuelExport:fuelExportColLabels.endUse'),
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
      (!params.value && <Typography variant="body4">Select</Typography>),
    cellStyle: (params) => cellErrorStyle(params, errors),
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
    minWidth: 260
  },
  {
    field: 'provisionOfTheAct',
    headerComponent: RequiredHeader,
    headerName: i18n.t('fuelExport:fuelExportColLabels.provisionOfTheAct'),
    cellEditor: 'agSelectCellEditor',
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>),
    cellEditorParams: (params) => ({
      values: optionsData?.fuelTypes
        ?.find((obj) => params.data.fuelType === obj.fuelType)
        ?.provisions.map((item) => item.name)
        .sort()
    }),
    cellStyle: (params) => cellErrorStyle(params, errors),
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
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: (params) => ({
      values: optionsData?.fuelTypes
        ?.find((obj) => params.data.fuelType === obj.fuelType)
        ?.fuelCodes.map((item) => item.fuelCode)
    }),
    cellStyle: (params) => {
      const style = cellErrorStyle(params, errors)
      const conditionalStyle =
        optionsData?.fuelTypes
          ?.find((obj) => params.data.fuelType === obj.fuelType)
          ?.fuelCodes.map((item) => item.fuelCode).length > 0 &&
        /Fuel code/i.test(params.data.provisionOfTheAct)
          ? { backgroundColor: '#fff', borderColor: 'unset' }
          : { backgroundColor: '#f2f2f2' }
      return { ...style, ...conditionalStyle }
    },
    suppressKeyboardEvent,
    minWidth: 135,
    editable: (params) =>
      optionsData?.fuelTypes
        ?.find((obj) => params.data.fuelType === obj.fuelType)
        ?.fuelCodes.map((item) => item.fuelCode).length > 0 &&
      /Fuel code/i.test(params.data.provisionOfTheAct)
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
    cellStyle: (params) => cellErrorStyle(params, errors)
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
      (!params.value && <Typography variant="body4">Select</Typography>),
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
    cellStyle: (params) => cellErrorStyle(params, errors),
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
    cellStyle: (params) => cellErrorStyle(params, errors),
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
    cellStyle: (params) => cellErrorStyle(params, errors),
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
    cellStyle: (params) => cellErrorStyle(params, errors),
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
