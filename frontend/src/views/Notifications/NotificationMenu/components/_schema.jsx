import { dateFormatter } from '@/utils/formatters'
import { actions } from '@/components/BCDataGrid/columns'
import { ROUTES } from '@/constants/routes'

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
    cellDataType: 'date',
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
    headerName: t('notifications:notificationColLabels.transactionId'),
    valueGetter: (params) => {
      const { service, id } = JSON.parse(params.data.message)
      if (service === 'Transfer') {
        return `CT${id}`
      } else if (service === 'InitiativeAgreement') {
        return `IA${id}`
      } else if (service === 'ComplianceReport') {
        return `CR${id}`
      } else {
        return id
      }
    }
  },
  {
    colId: 'organization',
    field: 'organization',
    headerName: t('notifications:notificationColLabels.organization'),
    valueGetter: (params) => {
      const { service, toOrganizationId, fromOrganization } = JSON.parse(
        params.data.message
      )
      if (
        service === 'Transfer' &&
        toOrganizationId === currentUser?.organization?.organizationId
      ) {
        return fromOrganization
      }
      return params.data.relatedOrganization.name
    }
  }
]

export const defaultColDef = {
  editable: false,
  resizable: true,
  sortable: true
}

export const routesMapping = (currentUser) => ({
  Transfer: ROUTES.TRANSFERS_VIEW,
  AdminAdjustment: currentUser.isGovernmentUser
    ? ROUTES.ADMIN_ADJUSTMENT_VIEW
    : ROUTES.ORG_ADMIN_ADJUSTMENT_VIEW,
  InitiativeAgreement: currentUser.isGovernmentUser
    ? ROUTES.INITIATIVE_AGREEMENT_VIEW
    : ROUTES.ORG_INITIATIVE_AGREEMENT_VIEW,
  ComplianceReport: ROUTES.REPORTS_VIEW
})
