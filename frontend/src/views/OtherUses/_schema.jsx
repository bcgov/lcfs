import { actions, validation } from '@/components/BCDataGrid/columns'
import {
  AutocompleteCellEditor,
  RequiredHeader,
  NumberEditor
} from '@/components/BCDataGrid/components'
import i18n from '@/i18n'
import { suppressKeyboardEvent } from '@/utils/grid/eventHandlers'
import BCTypography from '@/components/BCTypography'
import {
  decimalFormatter,
  formatNumberWithCommas as valueFormatter
} from '@/utils/formatters'
import { StandardCellWarningAndErrors } from '@/utils/grid/errorRenderers.jsx'

export const PROVISION_APPROVED_FUEL_CODE = 'Fuel code - section 19 (b) (i)'

export const otherUsesColDefs = (optionsData, errors, warnings) => [
  validation,
  actions({
    enableDuplicate: false,
    enableDelete: true
  }),
  {
    field: 'id',
    hide: true
  },
  {
    field: 'otherUsesId',
    hide: true
  },
  {
    field: 'fuelType',
    headerName: i18n.t('otherUses:otherUsesColLabels.fuelType'),
    headerComponent: RequiredHeader,
    cellEditor: AutocompleteCellEditor,
    minWidth: '280',
    cellEditorParams: {
      options: optionsData.fuelTypes.map((obj) => obj.fuelType),
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    },
    suppressKeyboardEvent,
    cellRenderer: (params) =>
      params.value || <BCTypography variant="body4">Select</BCTypography>,
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
    valueSetter: (params) => {
      if (params.newValue) {
        // TODO: Evaluate if additional fields need to be reset when fuel type changes
        params.data.fuelType = params.newValue
        params.data.fuelCode = undefined
      }
      return true
    }
  },
  {
    field: 'fuelCategory',
    headerName: i18n.t('otherUses:otherUsesColLabels.fuelCategory'),
    headerComponent: RequiredHeader,
    cellEditor: AutocompleteCellEditor,
    cellEditorParams: (params) => {
      const fuelType = optionsData?.fuelTypes?.find(
        (obj) => params.data.fuelType === obj.fuelType
      )
      return {
        options: fuelType
          ? fuelType.fuelCategories.map((item) => item.category)
          : [],
        multiple: false,
        disableCloseOnSelect: false,
        freeSolo: false,
        openOnFocus: true
      }
    },
    suppressKeyboardEvent,
    cellRenderer: (params) =>
      params.value || <BCTypography variant="body4">Select</BCTypography>,
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
    minWidth: 200
  },
  {
    field: 'provisionOfTheAct',
    headerComponent: RequiredHeader,
    headerName: i18n.t('otherUses:otherUsesColLabels.provisionOfTheAct'),
    cellEditor: AutocompleteCellEditor,
    cellEditorParams: (params) => {
      const fuelType = optionsData?.fuelTypes?.find(
        (type) => type.fuelType === params.data.fuelType
      )

      const provisionsOfTheAct = fuelType
        ? fuelType.provisionOfTheAct.map((provision) => provision.name)
        : []

      return {
        options: provisionsOfTheAct.sort(),
        multiple: false,
        disableCloseOnSelect: false,
        freeSolo: false,
        openOnFocus: true
      }
    },
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <BCTypography variant="body4">Select</BCTypography>),
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
    suppressKeyboardEvent,
    valueSetter: (params) => {
      if (params.newValue !== params.oldValue) {
        params.data.provisionOfTheAct = params.newValue
        params.data.fuelCode = '' // Reset fuelCode when provisionOfTheAct changes
        return true
      }
      return false
    },
    minWidth: 300,
    editable: true,
    tooltipValueGetter: (p) =>
      'Select the method for determining carbon intensity'
  },
  {
    field: 'fuelCode',
    headerName: i18n.t('otherUses:otherUsesColLabels.fuelCode'),
    cellEditor: AutocompleteCellEditor,
    cellEditorParams: (params) => {
      const fuelType = optionsData?.fuelTypes?.find(
        (obj) => params.data.fuelType === obj.fuelType
      )

      return {
        options: fuelType?.fuelCodes?.map((item) => item.fuelCode) || [], // Safely access fuelCodes
        multiple: false,
        disableCloseOnSelect: false,
        freeSolo: false,
        openOnFocus: true
      }
    },
    cellRenderer: (params) => {
      const fuelType = optionsData?.fuelTypes?.find(
        (obj) => params.data.fuelType === obj.fuelType
      )
      if (
        params.data.provisionOfTheAct === PROVISION_APPROVED_FUEL_CODE &&
        fuelType?.fuelCodes?.length > 0
      ) {
        return (
          params.value || <BCTypography variant="body4">Select</BCTypography>
        )
      }
      return null
    },
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
    suppressKeyboardEvent,
    minWidth: 150,
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
      const isFuelCodeScenario =
        params.data.provisionOfTheAct === PROVISION_APPROVED_FUEL_CODE
      const fuelType = optionsData?.fuelTypes?.find(
        (obj) => params.data.fuelType === obj.fuelType
      )
      const fuelCodes = fuelType?.fuelCodes || []

      if (
        isFuelCodeScenario &&
        !params.data.fuelCode &&
        fuelCodes.length === 1
      ) {
        // Autopopulate if only one fuel code is available
        const singleFuelCode = fuelCodes[0]
        params.data.fuelCode = singleFuelCode.fuelCode
        params.data.fuelCodeId = singleFuelCode.fuelCodeId
      }

      return params.data.fuelCode
    },
    tooltipValueGetter: () => 'Select the approved fuel code'
  },
  {
    field: 'quantitySupplied',
    headerName: i18n.t('otherUses:otherUsesColLabels.quantitySupplied'),
    headerComponent: RequiredHeader,
    cellEditor: NumberEditor,
    valueFormatter: (params) => valueFormatter({ value: params.value }),
    type: 'numericColumn',
    cellEditorParams: {
      precision: 0,
      showStepperButtons: false
    },
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
    minWidth: 200
  },
  {
    field: 'units',
    headerName: i18n.t('otherUses:otherUsesColLabels.units'),
    cellEditor: AutocompleteCellEditor,
    cellEditorParams: (params) => {
      const fuelType = optionsData?.fuelTypes?.find(
        (obj) => params.data.fuelType === obj.fuelType
      )
      const values = fuelType ? [fuelType.units] : []
      return {
        options: values,
        multiple: false,
        disableCloseOnSelect: false,
        freeSolo: false,
        openOnFocus: true
      }
    },
    cellRenderer: (params) => {
      return params.value ? (
        params.value
      ) : (
        <BCTypography variant="body4">Select</BCTypography>
      )
    },
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
    editable: true,
    minWidth: 100
  },
  {
    field: 'ciOfFuel',
    headerName: i18n.t('otherUses:otherUsesColLabels.ciOfFuel'),
    valueFormatter: (params) => parseFloat(params.value).toFixed(2),
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
    editable: false,
    valueGetter: (params) => {
      const fuelType = optionsData?.fuelTypes?.find(
        (obj) => params.data.fuelType === obj.fuelType
      )

      if (params.data.provisionOfTheAct === PROVISION_APPROVED_FUEL_CODE) {
        return (
          fuelType?.fuelCodes?.find(
            (item) => item.fuelCode === params.data.fuelCode
          )?.carbonIntensity || 0
        )
      }
      if (fuelType) {
        if (params.data.fuelType === 'Other' && params.data.fuelCategory) {
          const categories = fuelType.fuelCategories
          const defaultCI = categories?.find(
            (cat) => cat.category === params.data.fuelCategory
          )?.defaultAndPrescribedCi

          return defaultCI || 0
        }

        return fuelType.defaultCarbonIntensity || 0
      }

      return 0
    },
    minWidth: 150
  },
  {
    field: 'expectedUse',
    headerName: i18n.t('otherUses:otherUsesColLabels.expectedUse'),
    headerComponent: RequiredHeader,
    cellEditor: AutocompleteCellEditor,
    flex: 1,
    cellEditorParams: {
      options: optionsData.expectedUses.map((obj) => obj.name),
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    },
    suppressKeyboardEvent,
    cellRenderer: (params) =>
      params.value || <BCTypography variant="body4">Select</BCTypography>,
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
    minWidth: 200
  },
  {
    field: 'rationale',
    flex: 1,
    headerName: i18n.t('otherUses:otherUsesColLabels.otherExpectedUse'),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    editable: (params) => params.data.expectedUse === 'Other',
    minWidth: 300
  }
]

export const otherUsesSummaryColDefs = (t) => [
  {
    headerName: t('otherUses:otherUsesColLabels.fuelType'),
    field: 'fuelType',
    floatingFilter: false,
    width: '260px'
  },
  {
    headerName: t('otherUses:otherUsesColLabels.fuelCategory'),
    field: 'fuelCategory',
    floatingFilter: false
  },
  {
    headerName: t('otherUses:otherUsesColLabels.provisionOfTheAct'),
    field: 'provisionOfTheAct',
    floatingFilter: false
  },
  {
    headerName: t('otherUses:otherUsesColLabels.fuelCode'),
    field: 'fuelCode',
    floatingFilter: false
  },
  {
    headerName: t('otherUses:otherUsesColLabels.quantitySupplied'),
    field: 'quantitySupplied',
    floatingFilter: false,
    valueFormatter
  },
  {
    headerName: t('otherUses:otherUsesColLabels.units'),
    field: 'units',
    floatingFilter: false
  },
  {
    headerName: t('otherUses:otherUsesColLabels.ciOfFuel'),
    field: 'ciOfFuel',
    floatingFilter: false,
    valueFormatter: decimalFormatter
  },
  {
    headerName: t('otherUses:otherUsesColLabels.expectedUse'),
    field: 'expectedUse',
    floatingFilter: false,
    flex: 1,
    minWidth: 200
  },
  {
    headerName: t('otherUses:otherUsesColLabels.otherExpectedUse'),
    field: 'rationale',
    floatingFilter: false,
    flex: 1,
    minWidth: 200
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
