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
    style = { ...style, backgroundColor: '#f2f2f2' }
  }
  return style
}

export const fuelSupplyColDefs = (optionsData, errors) => [
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
    field: 'fuelType',
    headerComponent: HeaderComponent,
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.fuelType'),
    cellEditor: AutocompleteEditor,
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>),
    cellEditorParams: {
      options: optionsData?.fuelTypes?.map((obj) => obj.fuelType),
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    },
    cellStyle: (params) => cellErrorStyle(params, errors),
    suppressKeyboardEvent,
    minWidth: 260,
    editable: true,
    valueSetter: (params) => {
      if (params.newValue) {
        params.data.fuelType = params.newValue
        params.data.fuelCategory = undefined
        params.data.endUse = undefined
        params.data.eer = undefined
        params.data.determiningCarbonIntensity = undefined
        params.data.fuelCode = undefined
        params.data.quantitySupplied = undefined
        params.data.units = optionsData?.fuelTypes?.find(
          (obj) => obj.fuelType === params.newValue
        ).unit
      }
      return true
    },
    tooltipValueGetter: (p) => 'Select the fuel type from the list'
  },
  {
    field: 'fuelTypeOther',
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.fuelTypeOther'),
    cellStyle: (params) =>
      /other/i.test(params.data.fuelType)
        ? { backgroundColor: '#fff', borderColor: 'unset' }
        : { backgroundColor: '#f2f2f2' },
    editable: (params) => /other/i.test(params.data.fuelType)
  },
  {
    field: 'fuelCategory',
    headerComponent: HeaderComponent,
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.fuelCategory'),
    cellEditor: AutocompleteEditor,
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>),
    cellEditorParams: (params) => ({
      values: optionsData?.fuelTypes
        ?.find((obj) => params.data.fuelType === obj.fuelType)
        ?.fuelCategories.map((item) => item.fuelCategory)
    }),
    cellStyle: (params) => cellErrorStyle(params, errors),
    valueSetter: (params) => {
      if (params.newValue) {
        params.data.fuelCategory = params.newValue
        params.data.endUse = undefined
        params.data.eer = undefined
        params.data.determiningCarbonIntensity = undefined
        params.data.fuelCode = undefined
        params.data.quantitySupplied = undefined
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
    field: 'endUse',
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.endUse'),
    options: (params) =>
      [
        ...new Set(
          optionsData?.fuelTypes
            ?.find((obj) => params.data.fuelType === obj.fuelType)
            ?.eerRatios.filter(
              (item) =>
                item.fuelCategory.fuelCategory === params.data.fuelCategory
            )
            ?.map((item) => item.endUseType?.endUseType)
        )
      ].filter((item) => item != null) || [],
    cellEditorParams: (params) => ({
      options: params.colDef.options(params),
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    }),
    cellEditor: AutocompleteEditor,
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>),
    cellStyle: (params) => cellErrorStyle(params, errors),
    suppressKeyboardEvent,
    valueGetter: (params) => {
      if (params.colDef?.options(params).length < 1) {
        return 'Any'
      } else {
        return params.data.endUse
      }
    },
    editable: (params) => {
      console.log("I'm here")
      return params.colDef?.options(params).length > 0
    },
    minWidth: 260
  },
  {
    field: 'determiningCarbonIntensity',
    headerName: i18n.t(
      'fuelSupply:fuelSupplyColLabels.determiningCarbonIntensity'
    ),
    cellEditor: 'agSelectCellEditor',
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>),
    cellEditorParams: (params) => ({
      values: optionsData?.fuelTypes
        ?.find((obj) => params.data.fuelType === obj.fuelType)
        ?.provisions.map((item) => item.provision)
    }),
    cellStyle: (params) => cellErrorStyle(params, errors),
    suppressKeyboardEvent,
    minWidth: 370,
    valueSetter: (params) => {
      if (params.newValue) {
        params.data.determiningCarbonIntensity = params.newValue
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
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.fuelCode'),
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: (params) => ({
      values: optionsData?.fuelTypes
        ?.find((obj) => params.data.fuelType === obj.fuelType)
        ?.fuelCodes.map((item) => item.fuelCode)
    }),
    cellStyle: (params) =>
      optionsData?.fuelTypes
        ?.find((obj) => params.data.fuelType === obj.fuelType)
        ?.fuelCodes.map((item) => item.fuelCode).length > 0 &&
      /Fuel code/i.test(params.data.determiningCarbonIntensity)
        ? { backgroundColor: '#fff' }
        : { backgroundColor: '#f2f2f2' },
    suppressKeyboardEvent,
    minWidth: 135,
    editable: (params) =>
      optionsData?.fuelTypes
        ?.find((obj) => params.data.fuelType === obj.fuelType)
        ?.fuelCodes.map((item) => item.fuelCode).length > 0 &&
      /Fuel code/i.test(params.data.determiningCarbonIntensity)
  },
  {
    field: 'quantitySupplied',
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.quantitySupplied'),
    cellEditor: 'agNumberCellEditor',
    cellEditorParams: {
      precision: 0,
      min: 0,
      showStepperButtons: false
    },
    cellStyle: (params) => cellErrorStyle(params, errors)
  },
  {
    field: 'units',
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.units'),
    minWidth: 100,
    editable: false,
    cellStyle: (params) => cellErrorStyle(params, errors)
  },
  {
    field: 'complianceUnits',
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.complianceUnits'),
    minWidth: 100,
    editable: false,
    cellStyle: (params) => cellErrorStyle(params, errors)
  },
  {
    field: 'ciLimit',
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.ciLimit'),
    editable: false,
    cellStyle: (params) => cellErrorStyle(params, errors),
    valueGetter: (params) =>
      optionsData?.fuelTypes
        ?.find((obj) => params.data.fuelType === obj.fuelType)
        ?.targetCarbonIntensities.find(
          (item) => item.fuelCategory.fuelCategory === params.data.fuelCategory
        ).targetCarbonIntensity
  },
  {
    field: 'ciOfFuel',
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.ciOfFuel'),
    editable: false,
    cellStyle: (params) => cellErrorStyle(params, errors),
    valueGetter: (params) => {
      if (/Fuel code/i.test(params.data.determiningCarbonIntensity)) {
        return optionsData?.fuelTypes
          ?.find((obj) => params.data.fuelType === obj.fuelType)
          ?.fuelCodes.find((item) => item.fuelCode === params.data.fuelCode)
          ?.fuelCodeCarbonIntensity
      } else {
        return optionsData?.fuelTypes?.find(
          (obj) => params.data.fuelType === obj.fuelType
        )?.defaultCarbonIntensity
      }
    }
  },
  {
    field: 'energyDensity',
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.energyDensity'),
    cellEditor: 'agNumberCellEditor',
    cellStyle: (params) =>
      /other/i.test(params.data.fuelType)
        ? { backgroundColor: '#fff' }
        : { backgroundColor: '#f2f2f2' },
    cellEditorParams: {
      precision: 2,
      min: 0,
      showStepperButtons: false
    },
    valueGetter: (params) => {
      if (/other/i.test(params.data.fuelType)) {
        return params.data.energyDensity || 0
      } else {
        return optionsData?.fuelTypes?.find(
          (obj) => params.data.fuelType === obj.fuelType
        )?.energyDensity.energyDensity
      }
    },
    editable: (params) => /other/i.test(params.data.fuelType)
  },
  {
    field: 'eer',
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.eer'),
    editable: false,
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
            item.endUseType?.endUseType === params.data.endUse
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
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.energy'),
    minWidth: 100,
    editable: false
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
