// @ts-nocheck
import type { ColDef } from '@ag-grid-community/core'
import { dateFormatter } from '@/utils/formatters'
import { actions } from '@/components/BCDataGrid/columns'
import { BCDateFloatingFilter } from '@/components/BCDataGrid/components/Filters/BCDateFloatingFilter'

export { routesMapping } from './routeMapping'

export const columnDefs = (
  t: (key: string) => string,
  currentUser: Record<string, any>
): ColDef[] => [
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
    floatingFilterComponent: BCDateFloatingFilter,
    suppressFloatingFilterButton: true,
    headerName: t('notifications:notificationColLabels.date'),
    filter: 'agDateColumnFilter',
    filterParams: {
      filterOptions: ['equals']
    },
    valueGetter: (params) => params.data.createDate,
    valueFormatter: dateFormatter
  },
  {
    colId: 'user',
    field: 'user',
    headerName: t('notifications:notificationColLabels.user'),
    valueGetter: (params) =>
      params.data.originUserProfile?.fullName?.trim() || 'System'
  },
  {
    colId: 'transactionId',
    field: 'transactionId',
    headerName: t('notifications:notificationColLabels.transactionId'),
    valueGetter: (params) => params.data.relatedTransactionId
  },
  {
    colId: 'organization',
    field: 'organization',
    headerName: t('notifications:notificationColLabels.organization'),
    valueGetter: (params) => {
      try {
        const parsed = JSON.parse(params.data.message)
        const { service, toOrganizationId, fromOrganization } = parsed
        if (
          service === 'Transfer' &&
          toOrganizationId === currentUser?.organization?.organizationId
        ) {
          return fromOrganization
        }
      } catch {
        // Government notifications have different message format
      }
      return params.data.relatedOrganization?.name || ''
    }
  }
]

export const defaultColDef = {
  editable: false,
  resizable: true,
  sortable: true
}

export const defaultSortModel: Array<{ field: string; direction: string }> = [
  { field: 'date', direction: 'desc' }
]
