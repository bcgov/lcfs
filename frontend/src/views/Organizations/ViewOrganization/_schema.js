import { numberFormatter } from '@/utils/formatters'
import { OrgStatusRenderer } from '@/utils/cellRenderers'
import BCColumnSetFilter from '@/components/BCDataGrid/BCColumnSetFilter'
import { useOrganizationStatuses } from '@/hooks/useOrganization'
import { usersColumnDefs } from '@/views/Admin/AdminMenu/components/_schema'

export const organizationsColDefs = [
  { colId: 'name', field: 'name', headerName: 'Organization Name', width: 400 },
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
      return {
        ...colDef,
        sortable: false,
        suppressMenu: true,
        floatingFilter: false
      }
    }
    return colDef
  })
  return colDefs
}

export const usersColDefs = getUserColumnDefs()
export const defaultSortModel = [{ field: 'first_name', direction: 'asc' }]
export const defaultFilterModel = [
  { filterType: 'text', type: 'equals', field: 'is_active', filter: 'Active' }
]
