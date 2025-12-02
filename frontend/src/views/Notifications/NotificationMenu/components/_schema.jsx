import { dateFormatter } from '@/utils/formatters'
import { actions } from '@/components/BCDataGrid/columns'
import { ROUTES } from '@/routes/routes'
import { BCDateFloatingFilter } from '@/components/BCDataGrid/components'

export const columnDefs = (t, currentUser) => [
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

export const routesMapping = (currentUser) => ({
  Transfer: ROUTES.TRANSFERS.VIEW,
  AdminAdjustment: currentUser.isGovernmentUser
    ? ROUTES.TRANSACTIONS.ADMIN_ADJUSTMENT.VIEW
    : ROUTES.TRANSACTIONS.ADMIN_ADJUSTMENT.ORG_VIEW,
  InitiativeAgreement: currentUser.isGovernmentUser
    ? ROUTES.TRANSACTIONS.INITIATIVE_AGREEMENT.VIEW
    : ROUTES.TRANSACTIONS.INITIATIVE_AGREEMENT.ORG_VIEW,
  ComplianceReport: ROUTES.REPORTS.VIEW,
  'Fuel Code': ROUTES.FUEL_CODES.EDIT,
  'Fuel Code Status Update': ROUTES.FUEL_CODES.EDIT,
  'Fuel Code Recommended': ROUTES.FUEL_CODES.EDIT,
  'Fuel Code Approved': ROUTES.FUEL_CODES.EDIT,
  'Fuel Code Draft': ROUTES.FUEL_CODES.EDIT,
  'Fuel Code Returned': ROUTES.FUEL_CODES.EDIT
})

export const defaultSortModel = [{ field: 'date', direction: 'desc' }]
