import { actions, validation } from '@/components/BCDataGrid/columns'
import {
  AutocompleteCellEditor,
  NumberEditor
} from '@/components/BCDataGrid/components'
import i18n from '@/i18n'
import { suppressKeyboardEvent } from '@/utils/grid/eventHandlers'
import { Typography } from '@mui/material'
import { formatNumberWithCommas as valueFormatter } from '@/utils/formatters'
import { StandardCellErrors } from '@/utils/grid/errorRenderers.jsx'

export const otherUsesColDefs = (optionsData, errors) => [
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
    field: 'fuelType',
    headerName: i18n.t('otherUses:otherUsesColLabels.fuelType'),
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
      params.value || <Typography variant="body4">Select</Typography>,
    cellStyle: (params) => StandardCellErrors(params, errors)
  },
  {
    field: 'fuelCategory',
    headerName: i18n.t('otherUses:otherUsesColLabels.fuelCategory'),
    cellEditor: AutocompleteCellEditor,
    cellEditorParams: {
      options: optionsData.fuelCategories.map((obj) => obj.category),
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    },
    suppressKeyboardEvent,
    cellRenderer: (params) =>
      params.value || <Typography variant="body4">Select</Typography>,
    cellStyle: (params) => StandardCellErrors(params, errors)
  },
  {
    field: 'quantitySupplied',
    headerName: i18n.t('otherUses:otherUsesColLabels.quantitySupplied'),
    cellEditor: NumberEditor,
    valueFormatter,
    type: 'numericColumn',
    cellEditorParams: {
      precision: 0,
      min: 0,
      showStepperButtons: false
    },
    cellStyle: (params) => StandardCellErrors(params, errors)
  },
  {
    field: 'units',
    headerName: i18n.t('otherUses:otherUsesColLabels.units'),
    cellEditor: AutocompleteCellEditor,
    minWidth: '155',
    cellEditorParams: {
      options: optionsData.unitsOfMeasure.map((obj) => obj),
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    },
    suppressKeyboardEvent,
    cellRenderer: (params) =>
      params.value || <Typography variant="body4">Select</Typography>,
    cellStyle: (params) => StandardCellErrors(params, errors)
  },
  {
    field: 'expectedUse',
    headerName: i18n.t('otherUses:otherUsesColLabels.expectedUse'),
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
      params.value || <Typography variant="body4">Select</Typography>,
    cellStyle: (params) => StandardCellErrors(params, errors)
  },
  {
    field: 'rationale',
    flex: 1,
    headerName: i18n.t('otherUses:otherUsesColLabels.otherExpectedUse'),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    editable: (params) => params.data.expectedUse === 'Other'
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
