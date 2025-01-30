import { numberFormatter } from '@/utils/formatters'
import { LinkRenderer, OrgStatusRenderer } from '@/utils/grid/cellRenderers'
import { BCSelectFloatingFilter } from '@/components/BCDataGrid/components'
import { useOrganizationStatuses } from '@/hooks/useOrganizations'
import { usersColumnDefs } from '@/views/Admin/AdminMenu/components/_schema'

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
    filter: true,
    floatingFilterComponent: BCSelectFloatingFilter,
    floatingFilterComponentParams: {
      valueKey: 'status',
      labelKey: 'status',
      optionsQuery: useOrganizationStatuses
    },
    suppressFloatingFilterButton: true
  }
]

export const getUserColumnDefs = (t) => {
  return usersColumnDefs(t).map((colDef) => {
    if (colDef.field === 'isActive') {
      return {
        ...colDef,
        sortable: false
      }
    } else if (colDef.field === 'role') {
      // pick only supplier roles
      colDef.floatingFilterComponentParams.params =
        'government_roles_only=false'
      colDef.floatingFilterComponentParams.key = 'organization-users'
    }
    return colDef
  })
}

export const defaultSortModel = [{ field: 'firstName', direction: 'asc' }]
export const defaultFilterModel = [
  {
    field: 'isActive',
    filterType: 'text',
    type: 'equals',
    filter: 'Active'
  }
]
