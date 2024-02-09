import { phoneNumberFormatter } from '@/utils/formatters'
import {
  GovernmentRoleRenderer,
  RoleRenderer,
  StatusRenderer
} from '@/utils/cellRenderers'
import BCColumnSetFilter from '@/components/BCDataGrid/BCColumnSetFilter'
import { useRoleList } from '@/hooks/useRole'

export const usersColumnDefs = [
  {
    colId: 'first_name',
    field: 'first_name',
    headerName: 'User Name',
    minWidth: 250,
    valueGetter: (params) =>
      params.data.first_name + ' ' + params.data.last_name
  },
  {
    colId: 'role',
    field: 'role',
    headerName: 'Role(s)',
    valueGetter: (params) =>
      params.data.is_active
        ? params.data.roles.map((role) => role.name).join(', ')
        : '',
    flex: 1,
    width: 300,
    suppressMenu: true,
    filterParams: {
      textMatcher: (filter) => {
        const filterTextArray = filter.filterText.split(',')
        const filterValueArray = filter.value.split(',')
        const existsInFilterText = filterTextArray.some((value) =>
          filterValueArray.includes(value.trim())
        )
        const existsInFilterValue = filterValueArray.some((value) =>
          filterTextArray.includes(value.trim())
        )
        return existsInFilterText || existsInFilterValue
      },
      suppressFilterButton: true
    },
    floatingFilterComponent: BCColumnSetFilter,
    floatingFilterComponentParams: {
      suppressFilterButton: true,
      apiQuery: useRoleList, // all data returned should be an array which includes an object of key 'name'
      // Eg: [{id: 1, name: 'EntryListItem' }] except name all others are optional
      disableCloseOnSelect: true,
      multiple: true
    },
    cellRenderer: RoleRenderer,
    cellClass: 'vertical-middle'
  },
  { colId: 'email', field: 'email', width: 400 },
  {
    colId: 'phone',
    field: 'phone',
    valueFormatter: phoneNumberFormatter,
    filter: 'agTextColumnFilter'
  },
  {
    colId: 'is_active',
    field: 'is_active',
    headerName: 'Status',
    valueGetter: (params) => params.data.is_active,
    filterParams: {
      textMatcher: (filter) => {
        return true
      }
    },
    cellRenderer: StatusRenderer,
    cellClass: 'vertical-middle',
    floatingFilterComponent: BCColumnSetFilter,
    floatingFilterComponentParams: {
      suppressFilterButton: true,
      apiQuery: () => ({
        data: [
          { id: 1, name: 'Active' },
          { id: 0, name: 'Inactive' }
        ],
        isLoading: false
      }),
      disableCloseOnSelect: false,
      multiple: false
    },
    suppressMenu: false
  },
  {
    colId: 'organization_id',
    field: 'organization_id',
    filter: 'agNumberColumnFilter',
    headerName: 'Organization ID',
    valueGetter: (params) => params.data.organization.organization_id,
    hide: true
  }
]

export const usersDefaultColDef = {
  resizable: true,
  sortable: true,
  filter: true,
  minWidth: 300,
  floatingFilter: true, // enables the filter boxes under the header label
  suppressMenu: true // suppresses the menu button appearing next to the Header Label
}

export const rolesColumnDefs = [
  { colId: 'name', field: 'name', headerName: 'Role' },
  { colId: 'description', field: 'description', headerName: 'Description', flex: 1 },
  {
    colId: 'is_government_role',
    field: 'is_government_role',
    headerName: 'Role conferred to',
    valueGetter: (params) =>
      params.data.is_government_role ? 'Government' : 'Fuel Supplier',
    cellRenderer: GovernmentRoleRenderer,
    cellClass: 'vertical-middle'
  }
]

export const rolesDefaultColDef = {
  resizable: true,
  sortable: true
}

export const userActivityColDefs = [
  {
    colId: 'action',
    field: 'actionTaken',
    headerName: 'Action Taken'
  },
  {
    colId: 'transactionType',
    field: 'transactionType',
    headerName: 'Transaction Type'
  },
  {
    colId: 'transactionId',
    field: 'transactionId',
    headerName: 'Transaction ID'
  },
  {
    colId: 'timestamp',
    field: 'timestamp',
    headerName: 'Timestamp',
    filter: 'agDateColumnFilter'
  },
  {
    colId: 'organization',
    field: 'organization',
    headerName: 'Organization'
  }
]
