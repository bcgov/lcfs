import { KEY_ENTER, KEY_TAB } from '@/constants/common'
import {
  CommonArrayRenderer,
  TextRenderer
} from '@/utils/cellRenderers'
import { Typography } from '@mui/material'
import { v4 as uuid } from 'uuid'
import * as yup from 'yup'

export const notionalTransferColDefs = (t) => [
  {
    field: 'status',
    headerName: t('notionalTransfer:notionalTransferColLabels.status'),
    cellRenderer: TextRenderer
  },
  {
    field: 'transferId',
    headerName: t('notionalTransfer:notionalTransferColLabels.transferId'),
    cellRenderer: TextRenderer
  },
  {
    field: 'amount',
    headerName: t('notionalTransfer:notionalTransferColLabels.amount'),
    cellRenderer: TextRenderer,
    type: 'numericColumn'
  },
  {
    field: 'date',
    headerName: t('notionalTransfer:notionalTransferColLabels.date'),
    cellRenderer: TextRenderer
  },
  {
    field: 'fromAccount',
    headerName: t('notionalTransfer:notionalTransferColLabels.fromAccount'),
    cellRenderer: TextRenderer
  },
  {
    field: 'toAccount',
    headerName: t('notionalTransfer:notionalTransferColLabels.toAccount'),
    cellRenderer: TextRenderer
  },
  {
    field: 'comments',
    headerName: t('notionalTransfer:notionalTransferColLabels.comments'),
    cellRenderer: TextRenderer,
    minWidth: 300
  },
  {
    field: 'lastUpdated',
    headerName: t('notionalTransfer:notionalTransferColLabels.lastUpdated'),
    cellRenderer: TextRenderer
  }
]

export const addEditSchema = {
  duplicateRow: (props) => {
    const newRow = {
      ...props.data,
      id: uuid(),
      modified: true,
      transferId: 'TR' + (props.node?.rowIndex + 1)
    }
    props.api.applyTransaction({
      add: [newRow],
      addIndex: props.node?.rowIndex + 1
    })
    props.api.stopEditing()
  },

  onPrefixUpdate: (val, params) => {
    if (val === 'BCLCF') {
      params.node?.setData({
        ...params.data,
        transferId: 'TR' + (params.node?.rowIndex + 1)
      })
    }
  },

  notionalTransferSchema: (t, optionsData) =>
    yup.object().shape({
      transferId: yup.number().required(
        t('notionalTransfer:validateMsg.isRequired', {
          field: t('notionalTransfer:notionalTransferColLabels.transferId')
        })
      ),
      amount: yup.number().required(
        t('notionalTransfer:validateMsg.isRequired', {
          field: t('notionalTransfer:notionalTransferColLabels.amount')
        })
      ),
      date: yup.date().required(
        t('notionalTransfer:validateMsg.isRequired', {
          field: t('notionalTransfer:notionalTransferColLabels.date')
        })
      ),
      fromAccount: yup.string().required(
        t('notionalTransfer:validateMsg.isRequired', {
          field: t('notionalTransfer:notionalTransferColLabels.fromAccount')
        })
      ),
      toAccount: yup.string().required(
        t('notionalTransfer:validateMsg.isRequired', {
          field: t('notionalTransfer:notionalTransferColLabels.toAccount')
        })
      ),
      comments: yup.string()
    }),

  notionalTransferColDefs: (t, optionsData, isDraftOrNew = true) => [
    {
      colId: 'action',
      cellRenderer: 'actionsRenderer',
      cellRendererParams: {
        enableDuplicate: true,
        enableEdit: false,
        enableDelete: true,
        onDuplicate: addEditSchema.duplicateRow
      },
      pinned: 'left',
      maxWidth: 100,
      editable: false,
      suppressKeyboardEvent: (params) =>
        params.event.key === KEY_ENTER || params.event.key === KEY_TAB,
      filter: false,
      hide: !isDraftOrNew
    },
    {
      field: 'id',
      cellEditor: 'agTextCellEditor',
      cellDataType: 'text',
      hide: true
    },
    {
      field: 'transferId',
      headerName: t('notionalTransfer:notionalTransferColLabels.transferId'),
      cellEditor: 'agTextCellEditor',
      cellDataType: 'text',
      editable: false
    },
    {
      field: 'amount',
      headerName: t('notionalTransfer:notionalTransferColLabels.amount'),
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: {
        precision: 2,
        showStepperButtons: false
      },
      cellStyle: (params) => {
        if (params.data.modified && !params.value) return { borderColor: 'red' }
      },
      type: 'numericColumn',
      editable: isDraftOrNew
    },
    {
      field: 'date',
      headerName: t('notionalTransfer:notionalTransferColLabels.date'),
      cellRenderer: (params) => (
        <Typography variant="body4">
          {params.value ? params.value : 'YYYY-MM-DD'}
        </Typography>
      ),
      suppressKeyboardEvent: (params) =>
        params.editing &&
        (params.event.key === KEY_ENTER || params.event.key === KEY_TAB),
      cellStyle: (params) => {
        if (params.data.modified && (!params.value || params.value === ''))
          return { borderColor: 'red' }
      },
      cellEditor: 'dateEditor',
      editable: isDraftOrNew
    },
    {
      field: 'fromAccount',
      headerName: t('notionalTransfer:notionalTransferColLabels.fromAccount'),
      cellEditor: 'agTextCellEditor',
      cellDataType: 'text',
      cellStyle: (params) => {
        if (params.data.modified && (!params.value || params.value === ''))
          return { borderColor: 'red' }
      },
      minWidth: 300,
      editable: isDraftOrNew
    },
    {
      field: 'toAccount',
      headerName: t('notionalTransfer:notionalTransferColLabels.toAccount'),
      cellEditor: 'agTextCellEditor',
      cellDataType: 'text',
      cellStyle: (params) => {
        if (params.data.modified && (!params.value || params.value === ''))
          return { borderColor: 'red' }
      },
      minWidth: 300,
      editable: isDraftOrNew
    },
    {
      field: 'comments',
      headerName: t('notionalTransfer:notionalTransferColLabels.comments'),
      cellEditor: 'agTextCellEditor',
      cellDataType: 'text',
      minWidth: 300,
      editable: isDraftOrNew
    },
    {
      field: 'lastUpdated',
      headerName: t('notionalTransfer:notionalTransferColLabels.lastUpdated'),
      maxWidth: 180,
      minWidth: 180,
      cellRenderer: (params) => (
        <Typography variant="body4">
          {params.value ? params.value : 'YYYY-MM-DD'}
        </Typography>
      ),
      editable: false,
      cellDataType: 'dateString',
      valueGetter: (params) => {
        return new Date().toLocaleDateString()
      }
    }
  ],

  defaultColDef: {
    editable: true,
    resizable: true,
    filter: true,
    floatingFilter: false,
    sortable: false,
    singleClickEdit: true
  }
}
