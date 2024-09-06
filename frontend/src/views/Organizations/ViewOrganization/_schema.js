import { numberFormatter } from '@/utils/formatters'
import { LinkRenderer, OrgStatusRenderer } from '@/utils/cellRenderers'
import { BCColumnSetFilter } from '@/components/BCDataGrid/components'
import { useOrganizationStatuses } from '@/hooks/useOrganization'
import { usersColumnDefs } from '@/views/Admin/AdminMenu/components/_schema'
import { t } from 'i18next'

export const organizationsColDefs = (t) => [
  {
    colId: 'name',
    field: 'name',
    headerName: t('org:orgColLabels.orgName'),
    cellRenderer: LinkRenderer,
    minWidth: 400,
    flex: 1
  },
  {
    colId: 'complianceUnits',
    field: 'complianceUnits',
    headerName: t('org:orgColLabels.complianceUnits'),
    valueFormatter: numberFormatter,
    cellRenderer: LinkRenderer,
    width: 300,
    valueGetter: (params) => params.data.totalBalance,
    // Temporary measures
    // filter: 'agNumberColumnFilter',
    filter: false,
    sortable: false
  },
  {
    colId: 'reserve',
    field: 'reserve',
    headerName: t('org:orgColLabels.inReserve'),
    valueFormatter: numberFormatter,
    valueGetter: (params) => Math.abs(params.data.reservedBalance),
    width: 300,
    cellRenderer: LinkRenderer,
    // Temporary measures
    // filter: 'agNumberColumnFilter',
    filter: false,
    sortable: false
  },
  {
    colId: 'status',
    field: 'status',
    headerName: t('org:orgColLabels.status'),
    width: 300,
    valueGetter: (params) => params.data.orgStatus.status,
    cellRenderer: OrgStatusRenderer,
    cellClass: 'vertical-middle',
    floatingFilterComponent: BCColumnSetFilter,
    suppressFloatingFilterButton: true,
    floatingFilterComponentParams: {
      apiOptionField: 'status',
      apiQuery: useOrganizationStatuses,
      key: 'org-status',
      disableCloseOnSelect: false,
      multiple: false
    },
    suppressHeaderMenuButton: true
  }
]

export const getUserColumnDefs = (t) => {
  const colDefs = usersColumnDefs(t).map((colDef) => {
    if (colDef.field === 'isActive') {
      return {
        ...colDef,
        sortable: false,
        suppressHeaderMenuButton: true,
        floatingFilter: false
      }
    } else if (colDef.field === 'role') {
      // pick only supplier roles
      colDef.floatingFilterComponentParams.params =
        'government_roles_only=false'
      colDef.floatingFilterComponentParams.key = 'organization-users'
    }
    return colDef
  })
  return colDefs
}

export const usersColDefs = getUserColumnDefs(t)
export const defaultSortModel = [{ field: 'firstName', direction: 'asc' }]
export const defaultFilterModel = [
  { filterType: 'text', type: 'equals', field: 'isActive', filter: 'Active' }
]
