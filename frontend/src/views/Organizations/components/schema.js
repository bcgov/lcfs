import { numberFormatter } from '@/utils/formatters'
import { OrgStatusRenderer } from '@/utils/cellRenderers'
import BCColumnSetFilter from '@/components/BCDataGrid/BCColumnSetFilter'
import { useOrganizationStatuses } from '@/hooks/useOrganization'
import { usersColumnDefs } from '@/views/AdminMenu/components/schema'

export const organizationsColDefs = [
  { colId: 'name', field: 'name', headerName: 'Organization', width: 400 },
  {
    colId: 'complianceUnits',
    field: 'complianceUnits',
    headerName: 'Compliance Units',
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
    headerName: 'In Reserve',
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
    headerName: 'Status',
    width: 200,
    valueGetter: (params) => params.data.org_status.status,
    cellRenderer: OrgStatusRenderer,
    cellClass: 'vertical-middle',
    floatingFilterComponent: BCColumnSetFilter,
    floatingFilterComponentParams: {
      suppressFilterButton: true,
      apiOptionField: 'status',
      apiQuery: useOrganizationStatuses,
      disableCloseOnSelect: false,
      multiple: false
    },
    suppressMenu: true
  }
]


const getUserColumnDefs = () => {
  const colDefs = usersColumnDefs.map((colDef) => {
    if (colDef.field === 'is_active') {
      return { ...colDef, sortable: false, suppressMenu: true, }
    }
    return colDef
  })
  colDefs.push({
    colId: 'organization_id',
    field: 'organization_id',
    filter: 'agNumberColumnFilter',
    headerName: 'Organization ID',
    valueGetter: (params) => params.data.organization.organization_id,
    hide: true,
  })
  return colDefs
}

export const usersColDefs = getUserColumnDefs()
export const defaultSortModel = [{ field: 'display_name', direction: 'asc' }]
export const defaultFilterModel = [{ filterType: 'text', type: 'equals', field: 'is_active', filter: 'Active' }]