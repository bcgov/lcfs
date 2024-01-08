import { numberFormatter } from '@/utils/formatters'
import { OrgStatusRenderer } from '@/utils/cellRenderers'
import BCColumnSetFilter from '@/components/BCDataGrid/BCColumnSetFilter'
import { useOrganizationStatuses } from '@/hooks/useOrganization'

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

export const defaultSortModel = []
export const defaultFilterModel = []
