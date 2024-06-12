import { KEY_ENTER, KEY_TAB } from '@/constants/common'
import { CommonArrayRenderer } from '@/utils/cellRenderers'
import { DeleteForeverTwoTone } from '@mui/icons-material'
import { Typography } from '@mui/material'
import { v4 as uuid } from 'uuid'
import * as yup from 'yup'

// Copy the desired columns to new row
const duplicateRow = (props) => {
  const newRow = {
    ...props.data,
    id: uuid(),
    notionalTransferId: null,
    modified: true
  }
  
  if (props.api) {
    props.api.applyTransaction({
      add: [newRow],
      addIndex: props.node?.rowIndex + 1
    })
    props.api.stopEditing()
  } else {
    console.error('API is undefined')
  }
}

// const deleteRow = (props) => {
//   const updatedRow = { ...props.data, deleteFlag: true, modified: true }
//   console.log("ON DELETE")
  
//   if (props.api) {
//     props.api.applyTransaction({ update: [updatedRow] })
//     props.api.stopEditing()
//   } else {
//     console.error('API is undefined')
//   }
// }

export const notionalTransferSchema = (t, optionsData) =>
  yup.object().shape({
    legalName: yup.string().required(
      t('notionalTransfer:validateMsg.isRequired', {
        field: t('notionalTransfer:notionalTransferColLabels.legalName')
      })
    ),
    addressForService: yup.string().required(
      t('notionalTransfer:validateMsg.isRequired', {
        field: t('notionalTransfer:notionalTransferColLabels.addressForService')
      })
    ),
    fuelCategory: yup.string().required(
      t('notionalTransfer:validateMsg.isRequired', {
        field: t('notionalTransfer:notionalTransferColLabels.fuelCategory')
      })
    ),
    receivedOrTransferred: yup.string().required(
      t('notionalTransfer:validateMsg.isRequired', {
        field: t('notionalTransfer:notionalTransferColLabels.receivedOrTransferred')
      })
    ),
    quantity: yup.number().min(0, t('notionalTransfer:validateMsg.nonNegative')).required(
      t('notionalTransfer:validateMsg.isRequired', {
        field: t('notionalTransfer:notionalTransferColLabels.quantity')
      })
    ),
  })

export const notionalTransferColDefs = (t, optionsData, api) => [
  {
    colId: 'action',
    cellRenderer: 'actionsRenderer',
    cellRendererParams: {
      enableDuplicate: true,
      enableEdit: false,
      enableDelete: true,
      onDuplicate: (props) => duplicateRow({ ...props, api }),
      // onDelete: (props) => deleteRow({ ...props, api })
    },
    pinned: 'left',
    maxWidth: 100,
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
