import { actions, validation } from '@/components/BCDataGrid/columns'
import {
  AutocompleteCellEditor,
  NumberEditor,
  RequiredHeader
} from '@/components/BCDataGrid/components'
import BCTypography from '@/components/BCTypography'
import i18n from '@/i18n'
import colors from '@/themes/base/colors'
import {
  decimalFormatter,
  formatNumberWithCommas as valueFormatter
} from '@/utils/formatters'
import { changelogCellStyle } from '@/utils/grid/changelogCellStyle'
import { StandardCellWarningAndErrors } from '@/utils/grid/errorRenderers.jsx'
import { suppressKeyboardEvent } from '@/utils/grid/eventHandlers'
import { SelectRenderer } from '@/utils/grid/cellRenderers.jsx'

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
    cellRenderer: SelectRenderer,
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
    cellRenderer: SelectRenderer,
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
    cellRenderer: SelectRenderer,
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings),
    suppressKeyboardEvent,
    valueSetter: (params) => {
      if (params.newValue !== params.oldValue) {
        params.data.provisionOfTheAct = params.newValue
        params.data.fuelCode = undefined // Reset fuelCode when provisionOfTheAct changes
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
    cellRenderer: SelectRenderer,
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
    cellRenderer: SelectRenderer,
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
    cellRenderer: SelectRenderer,
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

export const otherUsesSummaryColDefs = [
  {
    headerName: i18n.t('otherUses:otherUsesColLabels.fuelType'),
    field: 'fuelType',
    floatingFilter: false,
    width: '260px'
  },
  {
    headerName: i18n.t('otherUses:otherUsesColLabels.fuelCategory'),
    field: 'fuelCategory',
    floatingFilter: false
  },
  {
    headerName: i18n.t('otherUses:otherUsesColLabels.provisionOfTheAct'),
    field: 'provisionOfTheAct',
    floatingFilter: false
  },
  {
    headerName: i18n.t('otherUses:otherUsesColLabels.fuelCode'),
    field: 'fuelCode',
    floatingFilter: false
  },
  {
    headerName: i18n.t('otherUses:otherUsesColLabels.quantitySupplied'),
    field: 'quantitySupplied',
    floatingFilter: false,
    valueFormatter
  },
  {
    headerName: i18n.t('otherUses:otherUsesColLabels.units'),
    field: 'units',
    floatingFilter: false
  },
  {
    headerName: i18n.t('otherUses:otherUsesColLabels.ciOfFuel'),
    field: 'ciOfFuel',
    floatingFilter: false,
    valueFormatter: decimalFormatter
  },
  {
    headerName: i18n.t('otherUses:otherUsesColLabels.expectedUse'),
    field: 'expectedUse',
    floatingFilter: false,
    flex: 1,
    minWidth: 200
  },
  {
    headerName: i18n.t('otherUses:otherUsesColLabels.otherExpectedUse'),
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

export const changelogCommonColDefs = [
  {
    headerName: i18n.t('otherUses:otherUsesColLabels.fuelType'),
    field: 'fuelType',
    valueGetter: (params) =>
      params.data.fuelType?.fuelType || params.data.fuelType,
    cellStyle: (params) => changelogCellStyle(params, 'fuelType')
  },
  {
    headerName: i18n.t('otherUses:otherUsesColLabels.fuelCategory'),
    field: 'fuelCategory',
    valueGetter: (params) =>
      params.data.fuelCategory?.category || params.data.fuelCategory,
    cellStyle: (params) => changelogCellStyle(params, 'fuelCategory')
  },
  {
    headerName: i18n.t('otherUses:otherUsesColLabels.provisionOfTheAct'),
    field: 'provisionOfTheAct',
    valueGetter: (params) =>
      params.data.provisionOfTheAct?.name || params.data.provisionOfTheAct,
    cellStyle: (params) => changelogCellStyle(params, 'provisionOfTheAct')
  },
  {
    headerName: i18n.t('otherUses:otherUsesColLabels.fuelCode'),
    field: 'fuelCode',
    valueGetter: (params) => params.data.endUseType?.type || 'Any',
    cellStyle: (params) => changelogCellStyle(params, 'fuelCode')
  },
  {
    headerName: i18n.t('otherUses:otherUsesColLabels.quantitySupplied'),
    field: 'quantitySupplied',
    valueFormatter,
    cellStyle: (params) => changelogCellStyle(params, 'quantitySupplied')
  },
  {
    headerName: i18n.t('otherUses:otherUsesColLabels.units'),
    field: 'units',
    cellStyle: (params) => changelogCellStyle(params, 'units')
  },
  {
    headerName: i18n.t('otherUses:otherUsesColLabels.ciOfFuel'),
    field: 'ciOfFuel',
    valueFormatter,
    cellStyle: (params) => changelogCellStyle(params, 'ciOfFuel')
  },
  {
    headerName: i18n.t('otherUses:otherUsesColLabels.expectedUse'),
    field: 'expectedUse',
    valueGetter: (params) =>
      params.data.expectedUse?.name || params.data.expectedUse,
    cellStyle: (params) => changelogCellStyle(params, 'expectedUse')
  },
  {
    headerName: i18n.t('otherUses:otherUsesColLabels.otherExpectedUse'),
    field: 'rationale',

    cellStyle: (params) => changelogCellStyle(params, 'rationale')
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
  overlayNoRowsTemplate: i18n.t('otherUses:noOtherUsesFound'),
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
