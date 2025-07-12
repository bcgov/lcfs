import { actions, validation } from '@/components/BCDataGrid/columns'
import {
  AutocompleteCellEditor,
  NumberEditor,
  RequiredHeader
} from '@/components/BCDataGrid/components'
import { ACTION_STATUS_MAP } from '@/constants/schemaConstants'
import i18n from '@/i18n'
import colors from '@/themes/base/colors'
import {
  decimalFormatter,
  formatNumberWithCommas as valueFormatter
} from '@/utils/formatters'
import { SelectRenderer } from '@/utils/grid/cellRenderers.jsx'
import { changelogCellStyle } from '@/utils/grid/changelogCellStyle'
import { StandardCellWarningAndErrors } from '@/utils/grid/errorRenderers.jsx'
import { suppressKeyboardEvent } from '@/utils/grid/eventHandlers'
import {
  formatFuelCodeOptions,
  extractOriginalFuelCode,
  formatFuelCodeWithCountryPrefix
} from '@/utils/fuelCodeCountryPrefix'

export const PROVISION_APPROVED_FUEL_CODE = 'Fuel code - section 19 (b) (i)'

export const otherUsesColDefs = (
  optionsData,
  errors,
  warnings,
  isSupplemental,
  compliancePeriod
) => [
  validation,
  actions((params) => ({
    enableDuplicate: false,
    enableDelete: !params.data.isNewSupplementalEntry,
    enableUndo: isSupplemental && params.data.isNewSupplementalEntry,
    enableStatus:
      isSupplemental &&
      params.data.isNewSupplementalEntry &&
      ACTION_STATUS_MAP[params.data.actionType]
  })),
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
      options: optionsData?.fuelTypes.map((obj) => obj.fuelType),
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    },
    suppressKeyboardEvent,
    cellRenderer: SelectRenderer,
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),

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
      StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),

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
      StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),

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
    cellRenderer: SelectRenderer,
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),

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
    tooltipValueGetter: () => 'Select the approved fuel code',
    valueGetter: (params) => {
      // Format the fuel code with country prefix for display
      if (params.data.fuelCode) {
        const fuelType = optionsData?.fuelTypes?.find(
          (obj) => params.data.fuelType === obj.fuelType
        )
        const fuelCodeDetails = fuelType?.fuelCodes?.find(
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
        return true
      }
      return false
    }
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
      StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),

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
      StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),

    editable: true,
    minWidth: 100
  },
  {
    field: 'ciOfFuel',
    headerName: i18n.t('otherUses:otherUsesColLabels.ciOfFuel'),
    valueFormatter: (params) => parseFloat(params.value).toFixed(2),
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),

    editable: false,
    valueGetter: (params) => {
      const fuelType = optionsData?.fuelTypes?.find(
        (obj) => params.data.fuelType === obj.fuelType
      )

      if (params.data.provisionOfTheAct === PROVISION_APPROVED_FUEL_CODE) {
        return (
          fuelType?.fuelCodes?.find(
            (item) => (item.fuelCode || item.fuel_code) === params.data.fuelCode
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
      options: optionsData?.expectedUses.map((obj) => obj.name),
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    },
    suppressKeyboardEvent,
    cellRenderer: SelectRenderer,
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings, isSupplemental),

    minWidth: 200
  },
  {
    field: 'rationale',
    flex: 1,
    headerName: i18n.t('otherUses:otherUsesColLabels.otherExpectedUse'),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    editable: (params) => params.data.expectedUse === 'Other',
    minWidth: 300,
    cellStyle: (params) =>
      StandardCellWarningAndErrors(params, errors, warnings, isSupplemental)
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
    floatingFilter: false,
    valueGetter: (params) => {
      return params.data.fuelCode || ''
    }
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

export const changelogCommonColDefs = (highlight = true) => [
  {
    headerName: i18n.t('otherUses:otherUsesColLabels.fuelType'),
    field: 'fuelType.fuelType',
    cellStyle: (params) => highlight && changelogCellStyle(params, 'fuelType')
  },
  {
    headerName: i18n.t('otherUses:otherUsesColLabels.fuelCategory'),
    field: 'fuelCategory.category',
    cellStyle: (params) =>
      highlight && changelogCellStyle(params, 'fuelCategory')
  },
  {
    headerName: i18n.t('otherUses:otherUsesColLabels.provisionOfTheAct'),
    field: 'provisionOfTheAct.name',
    cellStyle: (params) =>
      highlight && changelogCellStyle(params, 'provisionOfTheAct')
  },
  {
    headerName: i18n.t('otherUses:otherUsesColLabels.fuelCode'),
    field: 'fuelCode.fuelCode',
    cellStyle: (params) => highlight && changelogCellStyle(params, 'fuelCode'),
    valueGetter: (params) => {
      const fuelCode = params.data.fuelCode
      if (fuelCode && fuelCode.fuelCode) {
        const country = fuelCode.fuelProductionFacilityCountry
        const prefix = country?.toLowerCase() === 'canada' ? 'C-' : ''
        return `${prefix}${fuelCode.fuelCode}`
      }
      return ''
    }
  },
  {
    headerName: i18n.t('otherUses:otherUsesColLabels.quantitySupplied'),
    field: 'quantitySupplied',
    valueFormatter,
    cellStyle: (params) =>
      highlight && changelogCellStyle(params, 'quantitySupplied')
  },
  {
    headerName: i18n.t('otherUses:otherUsesColLabels.units'),
    field: 'units',
    cellStyle: (params) => highlight && changelogCellStyle(params, 'units')
  },
  {
    headerName: i18n.t('otherUses:otherUsesColLabels.ciOfFuel'),
    field: 'ciOfFuel',
    valueFormatter,
    cellStyle: (params) => highlight && changelogCellStyle(params, 'ciOfFuel')
  },
  {
    headerName: i18n.t('otherUses:otherUsesColLabels.expectedUse'),
    field: 'expectedUse.name',
    cellStyle: (params) =>
      highlight && changelogCellStyle(params, 'expectedUse')
  },
  {
    headerName: i18n.t('otherUses:otherUsesColLabels.otherExpectedUse'),
    field: 'rationale',

    cellStyle: (params) => highlight && changelogCellStyle(params, 'rationale')
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
