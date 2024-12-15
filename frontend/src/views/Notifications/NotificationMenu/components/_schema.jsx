import { dateFormatter } from '@/utils/formatters'
import { actions } from '@/components/BCDataGrid/columns'

export const columnDefs = (t) => [
  {
    ...actions({ enableDelete: true }),
    headerName: 'Delete',
    pinned: ''
  },
  {
    colId: 'type',
    field: 'type',
    headerName: t('notifications:notificationColLabels.type')
  },
  {
    colId: 'date',
    field: 'date',
    headerName: t('notifications:notificationColLabels.date'),
    valueGetter: (params) => params.data.createDate,
    valueFormatter: dateFormatter
  },
  {
    colId: 'user',
    field: 'user',
    headerName: t('notifications:notificationColLabels.user'),
    valueGetter: (params) => params.data.originUserProfile.fullName.trim()
  },
  {
    colId: 'transactionId',
    field: 'transactionId',
    headerName: t('notifications:notificationColLabels.transactionId')
  },
  {
    colId: 'organization',
    field: 'organization',
    headerName: t('notifications:notificationColLabels.organization'),
    valueGetter: (params) => params.data.relatedOrganization.name
  }
]

export const defaultColDef = {
  editable: false,
  resizable: true,
  sortable: true
}
