import { phoneNumberFormatter } from '@/utils/formatters'
import {
  GovernmentRoleRenderer,
  RoleRenderer,
  StatusRenderer
} from '@/utils/cellRenderers'
import BCColumnSetFilter from '@/components/BCDataGrid/BCColumnSetFilter'
import { useRoleList } from '@/hooks/useRole'

export const usersColumnDefs = (t) => [
  {
    colId: 'first_name',
    field: 'first_name',
    minWidth: 250,
    headerName: t('admin:userColLabels.userName'),
    valueGetter: (params) =>
      params.data.first_name + ' ' + params.data.last_name
  },
  {
    colId: 'role',
    field: 'role',
    headerName: t('admin:userColLabels.role'),
    valueGetter: (params) =>
      params.data.is_active
        ? params.data.roles.map((role) => role.name).join(', ')
        : '',
    flex: 1,
    width: 300,
    sortable: false,
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
      params: "government_roles_only=true",
      multiple: true
    },
    cellRenderer: RoleRenderer,
    cellClass: 'vertical-middle'
  },
  {
    colId: 'email',
    field: 'keycloak_email',
    headerName: t('admin:userColLabels.email'),
    width: 400
  },
  {
    colId: 'phone',
    field: 'phone',
    headerName: t('admin:userColLabels.phone'),
    valueFormatter: phoneNumberFormatter,
    filter: 'agTextColumnFilter'
  },
  {
    colId: 'is_active',
    field: 'is_active',
    headerName: t('admin:userColLabels.status'),
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
          { id: 1, name: t('admin:userColLabels.active') },
          { id: 0, name: t('admin:userColLabels.inactive') }
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
    headerName: t('admin:OrgId'),
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

export const idirUserDefaultFilter = [
  { filterType: 'text', type: 'blank', field: 'organization_id', filter: '' }
]

export const rolesColumnDefs = (t) => [
  { colId: 'name', field: 'name', headerName: t('admin:roleColLabels.role') },
  { colId: 'description', field: 'description', headerName: t('admin:roleColLabels.description'), flex: 1 },
  {
    colId: 'is_government_role',
    field: 'is_government_role',
    headerName: t('admin:roleColLabels.roleOf'),
    valueGetter: (params) =>
      params.data.is_government_role ? t('gov') : t('supplier'),
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
