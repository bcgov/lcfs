import { actions, validation } from '@/components/BCDataGrid/columns'
import {
  AutocompleteCellEditor,
  RequiredHeader,
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
    // TODO Temporary column to show version types, change this logic in later ticket
    field: 'actionType',
    headerName: i18n.t('fuelSupply:fuelSupplyColLabels.actionType'),
    minWidth: 125,
    maxWidth: 150,
    editable: false,
    cellStyle: (params) => {
      switch (params.data.actionType) {
        case 'CREATE':
          return {
            backgroundColor: '#e0f7df',
            color: '#388e3c',
            fontWeight: 'bold'
          }
        case 'UPDATE':
          return {
            backgroundColor: '#fff8e1',
            color: '#f57c00',
            fontWeight: 'bold'
          }
        case 'DELETE':
          return {
            backgroundColor: '#ffebee',
            color: '#d32f2f',
            fontWeight: 'bold'
          }
        default:
          return {}
      }
    },
    cellRenderer: (params) => {
      switch (params.data.actionType) {
        case 'CREATE':
          return 'Create'
        case 'UPDATE':
          return 'Edit'
        case 'DELETE':
          return 'Deleted'
        default:
          return ''
      }
    },
    tooltipValueGetter: (params) => {
      const actionMap = {
        CREATE: 'This record was created.',
        UPDATE: 'This record has been edited.',
        DELETE: 'This record was deleted.'
      }
      return actionMap[params.data.actionType] || ''
    }
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
      params.value || <Typography variant="body4">Select</Typography>,
    cellStyle: (params) => StandardCellErrors(params, errors)
  },
  {
    field: 'fuelCategory',
    headerName: i18n.t('otherUses:otherUsesColLabels.fuelCategory'),
    headerComponent: RequiredHeader,
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
    headerComponent: RequiredHeader,
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
    headerComponent: RequiredHeader,
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
  filter: false,
  floatingFilter: false,
  sortable: false,
  singleClickEdit: true
}
