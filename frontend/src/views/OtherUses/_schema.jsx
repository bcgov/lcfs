import { KEY_ENTER, KEY_TAB } from '@/constants/common'
import { Typography } from '@mui/material'
import { OtherUsesActions } from './components/OtherUsesActions'
import { suppressKeyboardEvent } from '@/utils/eventHandlers'
import i18n from '@/i18n'
import { actions, validation } from '@/components/BCDataGrid/columns'
import { AutocompleteEditor } from '@/components/BCDataGrid/components'

const cellErrorStyle = (params, errors) => {
  if (
    errors[params.data.id] &&
    errors[params.data.id].includes(params.colDef.field)
  ) {
    return {
      borderColor: 'red'
    }
  } else {
    return {
      borderColor: 'unset'
    }
  }
}

export const otherUsesColDefs = (optionsData, errors) => [
  validation,
  actions({
    enableDuplicate: true,
    enableDelete: true
  }),
  {
    field: 'id',
    hide: true
  },
  {
    field: 'fuelType',
    headerName: i18n.t('otherUses:otherUsesColLabels.fuelType'),
    cellEditor: AutocompleteEditor,
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
    cellStyle: (params) => cellErrorStyle(params, errors)
  },
  {
    field: 'fuelCategory',
    headerName: i18n.t('otherUses:otherUsesColLabels.fuelCategory'),
    cellEditor: AutocompleteEditor,
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
    cellStyle: (params) => cellErrorStyle(params, errors)
  },
  {
    field: 'quantitySupplied',
    headerName: i18n.t('otherUses:otherUsesColLabels.quantitySupplied'),
    cellEditor: 'agNumberCellEditor',
    type: 'numericColumn',
    cellEditorParams: {
      precision: 0,
      min: 0,
      showStepperButtons: false
    },
    cellStyle: (params) => cellErrorStyle(params, errors)
  },
  {
    field: 'units',
    headerName: i18n.t('otherUses:otherUsesColLabels.units'),
    cellEditor: AutocompleteEditor,
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
    cellStyle: (params) => cellErrorStyle(params, errors)
  },
  {
    field: 'expectedUse',
    headerName: i18n.t('otherUses:otherUsesColLabels.expectedUse'),
    cellEditor: AutocompleteEditor,
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
    cellStyle: (params) => cellErrorStyle(params, errors)
  },
  {
    field: 'rationale',
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
