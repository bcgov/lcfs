import { KEY_ENTER, KEY_TAB } from '@/constants/common'
import { Typography } from '@mui/material'
import { NotionalTransferActions } from './components/NotionalTransferActions'
import { suppressKeyboardEvent } from '@/utils/eventHandlers'

export const notionalTransferColDefs = (t, optionsData, api, onValidated) => [
  {
    colId: 'validation',
    cellRenderer: 'validationRenderer',
    pinned: 'left',
    maxWidth: 75,
    editable: false,
    suppressKeyboardEvent: (params) =>
      params.event.key === KEY_ENTER || params.event.key === KEY_TAB,
    filter: false
  },
  {
    colId: 'action',
    cellRenderer: NotionalTransferActions,
    cellRendererParams: { api, onValidated },
    pinned: 'left',
    maxWidth: 110,
    editable: false,
    suppressKeyboardEvent: (params) =>
      params.event.key === KEY_ENTER || params.event.key === KEY_TAB,
    filter: false
  },
  {
    field: 'id',
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    hide: true
  },
  {
    field: 'complianceReportId',
    headerName: t('notionalTransfer:notionalTransferColLabels.complianceReportId'),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    hide: true
  },
  {
    field: 'legalName',
    headerName: t('notionalTransfer:notionalTransferColLabels.legalName'),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    cellStyle: (params) => {
      if (params.data.modified && (!params.value || params.value === ''))
        return { borderColor: 'red' }
    },
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>)
  },
  {
    field: 'addressForService',
    headerName: t('notionalTransfer:notionalTransferColLabels.addressForService'),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    cellStyle: (params) => {
      if (params.data.modified && (!params.value || params.value === ''))
        return { borderColor: 'red' }
    },
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>)
  },
  {
    field: 'fuelCategory',
    headerName: t('notionalTransfer:notionalTransferColLabels.fuelCategory'),
    cellEditor: 'autocompleteEditor',
    suppressKeyboardEvent,
    cellDataType: 'text',
    cellEditorParams: {
      options: optionsData.fuelCategories.map((obj) => obj.category),
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    },
    cellStyle: (params) => {
      if (params.data.modified && (!params.value || params.value === ''))
        return { borderColor: 'red' }
    },
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>)
  },
  {
    field: 'receivedOrTransferred',
    headerName: t('notionalTransfer:notionalTransferColLabels.receivedOrTransferred'),
    cellEditor: 'autocompleteEditor',
    suppressKeyboardEvent,
    cellDataType: 'text',
    cellEditorParams: {
      options: optionsData?.receivedOrTransferred || [],
      multiple: false,
      disableCloseOnSelect: false,
      freeSolo: false,
      openOnFocus: true
    },
    cellStyle: (params) => {
      if (params.data.modified && (!params.value || params.value === ''))
        return { borderColor: 'red' }
    },
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>)
  },
  {
    field: 'quantity',
    headerName: t('notionalTransfer:notionalTransferColLabels.quantity'),
    cellEditor: 'agNumberCellEditor',
    type: 'numericColumn',
    cellEditorParams: {
      precision: 0,
      min: 0,
      showStepperButtons: false
    },
    cellStyle: (params) => {
      if (params.data.modified && !params.value) return { borderColor: 'red' }
    }
  },
]

export const defaultColDef = {
  editable: true,
  resizable: true,
  filter: true,
  floatingFilter: false,
  sortable: false,
  singleClickEdit: true
}
