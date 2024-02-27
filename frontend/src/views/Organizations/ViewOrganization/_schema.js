import { numberFormatter } from '@/utils/formatters'
import { OrgStatusRenderer } from '@/utils/cellRenderers'
import BCColumnSetFilter from '@/components/BCDataGrid/BCColumnSetFilter'
import { useOrganizationStatuses } from '@/hooks/useOrganization'
import { usersColumnDefs } from '@/views/Admin/AdminMenu/components/_schema'
import { t } from 'i18next'

export const organizationsColDefs = (t) => [
  { colId: 'name', field: 'name', headerName: t('org:orgColLabels.orgName'), maxWidth: 800, flex: 1 },
  {
    colId: 'complianceUnits',
    field: 'complianceUnits',
    headerName: t('org:orgColLabels.complianceUnits'),
    valueFormatter: numberFormatter,
    valueGetter: () => Math.round(Math.random() * (500000 - 100000) + 100000),
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
    valueGetter: () => Math.round(Math.random() * (100000 - 0)),
    // Temporary measures
    // filter: 'agNumberColumnFilter',
    filter: false,
    sortable: false
  },
  {
    colId: 'status',
    field: 'status',
    headerName: t('org:orgColLabels.status'),
    width: 200,
    valueGetter: (params) => params.data.org_status.status,
    cellRenderer: OrgStatusRenderer,
    cellClass: 'vertical-middle',
    floatingFilterComponent: BCColumnSetFilter,
    floatingFilterComponentParams: {
      suppressFilterButton: true,
      apiOptionField: 'status',
      apiQuery: useOrganizationStatuses,
      key: "org-status",
      disableCloseOnSelect: false,
      multiple: false
    },
    suppressMenu: true
  }
]

export const getUserColumnDefs = (t) => {
  const colDefs = usersColumnDefs(t).map((colDef) => {
    if (colDef.field === 'is_active') {
      return {
        ...colDef,
        sortable: false,
        suppressMenu: true,
        floatingFilter: false
      }
    } else if (colDef.field === 'role') {
      // pick only supplier roles
      colDef.floatingFilterComponentParams.params = "government_roles_only=false"
      colDef.floatingFilterComponentParams.key = "organization-users"
    }
    return colDef
  })
  return colDefs
}

export const usersColDefs = getUserColumnDefs(t)
export const defaultSortModel = [{ field: 'first_name', direction: 'asc' }]
export const defaultFilterModel = [
  { filterType: 'text', type: 'equals', field: 'is_active', filter: 'Active' }
]
