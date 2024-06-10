import { KEY_ENTER, KEY_TAB } from '@/constants/common'
import { CommonArrayRenderer } from '@/utils/cellRenderers'
import { Typography } from '@mui/material'
import { v4 as uuid } from 'uuid'
import * as yup from 'yup'

// copy the desired columns to new row
const duplicateRow = (props) => {
  const newRow = {
    ...props.data,
    id: uuid(),
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

export const notionalTransferSchema = (t, optionsData) =>
  yup.object().shape({
    complianceReportId: yup.number().required(
      t('notionalTransfer:validateMsg.isRequired', {
        field: t('notionalTransfer:notionalTransferColLabels.complianceReportId')
      })
    ),
    quantity: yup.number().min(0, t('notionalTransfer:validateMsg.nonNegative')).required(
      t('notionalTransfer:validateMsg.isRequired', {
        field: t('notionalTransfer:notionalTransferColLabels.quantity')
      })
    ),
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
    fuelCategoryId: yup.number().required(
      t('notionalTransfer:validateMsg.isRequired', {
        field: t('notionalTransfer:notionalTransferColLabels.fuelCategoryId')
      })
    ),
    receivedOrTransferred: yup.string().required(
      t('notionalTransfer:validateMsg.isRequired', {
        field: t('notionalTransfer:notionalTransferColLabels.receivedOrTransferred')
      })
    )
  })

export const notionalTransferColDefs = (t, optionsData, api) => [
  {
    colId: 'action',
    cellRenderer: 'actionsRenderer',
    cellRendererParams: {
      enableDuplicate: true,
      enableEdit: false,
      enableDelete: true,
      onDuplicate: (props) => duplicateRow({ ...props, api })
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
    field: 'fuelCategoryId',
    headerName: t('notionalTransfer:notionalTransferColLabels.fuelCategoryId'),
    cellEditor: 'autocompleteEditor',
    cellDataType: 'text',
    cellEditorParams: {
      options: optionsData.fuelCategories.map((obj) => obj.fuelCategoryId),
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
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    cellStyle: (params) => {
      if (params.data.modified && (!params.value || params.value === ''))
        return { borderColor: 'red' }
    },
    cellRenderer: (params) =>
      params.value ||
      (!params.value && <Typography variant="body4">Select</Typography>)
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
