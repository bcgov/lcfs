import { KEY_ENTER, KEY_TAB } from '@/constants/common'
import { Typography } from '@mui/material'
import { OtherUsesActions } from './components/OtherUsesActions'
import { suppressKeyboardEvent } from '@/utils/eventHandlers'

export const otherUsesColDefs = (t, optionsData, api, onValidated) => [
  {
    colId: 'validation',
    cellRenderer: 'validationRenderer',
    pinned: 'left',
    maxWidth: 75,
    editable: false,
    suppressKeyboardEvent,
    filter: false
  },
  {
    colId: 'action',
    cellRenderer: OtherUsesActions,
    cellRendererParams: { api, onValidated },
    pinned: 'left',
    maxWidth: 110,
    editable: false,
    suppressKeyboardEvent,
    filter: false
  },
  {
    field: 'id',
    hide: true
  },
  {
    field: 'fuelType',
    headerName: t('otherUses:otherUsesColLabels.fuelType'),
    cellEditor: 'autocompleteEditor',
    minWidth: '280',
    cellEditorParams: {
      options: optionsData.fuelTypes
        .map((obj) => obj.fuelType),
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    },
    suppressKeyboardEvent,
    cellRenderer: (params) => params.value || <Typography variant="body4">Select</Typography>,
    cellStyle: (params) => params.data.modified && !params.value ? { borderColor: 'red' } : undefined
  },
  {
    field: 'fuelCategory',
    headerName: t('otherUses:otherUsesColLabels.fuelCategory'),
    cellEditor: 'autocompleteEditor',
    cellEditorParams: {
      options: optionsData.fuelCategories
        .map((obj) => obj.category),
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    },
    suppressKeyboardEvent,
    cellRenderer: (params) => params.value || <Typography variant="body4">Select</Typography>,
    cellStyle: (params) => params.data.modified && !params.value ? { borderColor: 'red' } : undefined
  },
  {
    field: 'quantitySupplied',
    headerName: t('otherUses:otherUsesColLabels.quantitySupplied'),
    cellEditor: 'agNumberCellEditor',
    type: 'numericColumn',
    cellEditorParams: {
      precision: 0,
      min: 0,
      showStepperButtons: false
    },
    cellStyle: (params) => params.data.modified && !params.value ? { borderColor: 'red' } : undefined
  },
  {
    field: 'units',
    headerName: t('otherUses:otherUsesColLabels.units'),
    cellEditor: 'autocompleteEditor',
    minWidth: '155',
    cellEditorParams: {
      options: optionsData.unitsOfMeasure
        .map((obj) => obj.name),
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    },
    suppressKeyboardEvent,
    cellRenderer: (params) => params.value || <Typography variant="body4">Select</Typography>,
    cellStyle: (params) => params.data.modified && !params.value ? { borderColor: 'red' } : undefined
  },
  {
    field: 'expectedUse',
    headerName: t('otherUses:otherUsesColLabels.expectedUse'),
    cellEditor: 'autocompleteEditor',
    cellEditorParams: {
      options: optionsData.expectedUses
        .map((obj) => obj.name),
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    },
    suppressKeyboardEvent,
    cellRenderer: (params) => params.value || <Typography variant="body4">Select</Typography>,
    cellStyle: (params) => params.data.modified && !params.value ? { borderColor: 'red' } : undefined
  },
  {
    field: 'rationale',
    headerName: t('otherUses:otherUsesColLabels.otherExpectedUse'),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    cellStyle: (params) => params.data.modified && !params.value ? { borderColor: 'red' } : undefined,
    hide: (params) => params.data.expectedUse === 'Other'
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
