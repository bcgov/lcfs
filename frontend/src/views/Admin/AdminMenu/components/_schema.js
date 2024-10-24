import { phoneNumberFormatter, dateFormatter } from '@/utils/formatters'
import {
  LinkRenderer,
  RoleRenderer,
  StatusRenderer
} from '@/utils/grid/cellRenderers'
import { BCColumnSetFilter } from '@/components/BCDataGrid/components'
import { useRoleList } from '@/hooks/useRole'

export const usersColumnDefs = (t) => [
  {
    colId: 'firstName',
    field: 'firstName',
    minWidth: 250,
    headerName: t('admin:userColLabels.userName'),
    cellRenderer: LinkRenderer,
    valueGetter: (params) => params.data.firstName + ' ' + params.data.lastName
  },
  {
    colId: 'role',
    field: 'role',
    headerName: t('admin:userColLabels.role'),
    valueGetter: (params) =>
      params.data.isActive
        ? params.data.roles.map((role) => role.name).join(', ')
        : '',
    flex: 1,
    minWidth: 300,
    sortable: false,
    suppressHeaderMenuButton: true,
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
    suppressFloatingFilterButton: true,
    floatingFilterComponentParams: {
      apiQuery: useRoleList, // all data returned should be an array which includes an object of key 'name'
      // Eg: [{id: 1, name: 'EntryListItem' }] except name all others are optional
      params: 'government_roles_only=true',
      key: 'admin-users',
      disableCloseOnSelect: false,
      multiple: false
    },
    cellRenderer: RoleRenderer,
    cellClass: 'vertical-middle'
  },
  {
    colId: 'email',
    field: 'keycloakEmail',
    headerName: t('admin:userColLabels.email'),
    cellRenderer: LinkRenderer,
    minWidth: 300
  },
  {
    colId: 'phone',
    field: 'phone',
    headerName: t('admin:userColLabels.phone'),
    cellRenderer: LinkRenderer,
    valueFormatter: phoneNumberFormatter,
    filter: 'agTextColumnFilter',
    minWidth: 120
  },
  {
    colId: 'isActive',
    field: 'isActive',
    headerName: t('admin:userColLabels.status'),
    valueGetter: (params) => params.data.isActive,
    filterParams: {
      textMatcher: (filter) => {
        return true
      }
    },
    cellRenderer: StatusRenderer,
    cellClass: 'vertical-middle',
    floatingFilterComponent: BCColumnSetFilter,
    suppressFloatingFilterButton: true,
    floatingFilterComponentParams: {
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
    minWidth: 120,
    suppressHeaderMenuButton: false
  },
  {
    colId: 'organizationId',
    field: 'organizationId',
    filter: 'agNumberColumnFilter',
    headerName: t('admin:OrgId'),
    valueGetter: (params) => params.data.organization.organizationId,
    hide: true
  }
]

export const usersDefaultColDef = {
  resizable: true,
  sortable: true,
  filter: true,
  minWidth: 300,
  floatingFilter: true, // enables the filter boxes under the header label
  suppressHeaderMenuButton: true // suppresses the menu button appearing next to the Header Label
}

export const idirUserDefaultFilter = [
  { filterType: 'text', type: 'blank', field: 'organizationId', filter: '' }
]

const prefixMap = {
  Transfer: 'CT',
  AdminAdjustment: 'AA',
  InitiativeAgreement: 'IA'
}

export const userActivityColDefs = [
  {
    colId: 'actionTaken',
    field: 'actionTaken',
    headerName: 'Action Taken',
  },
  {
    colId: 'transactionType',
    field: 'transactionType',
    headerName: 'Transaction Type',
  },
  {
    colId: 'transactionId',
    field: 'transactionId',
    headerName: 'Transaction ID',
    valueGetter: (params) => {
      const transactionType = params.data.transactionType
      const prefix = prefixMap[transactionType] || ''
      return `${prefix}${params.data.transactionId}`
    },
  },
  {
    colId: 'createDate',
    field: 'createDate',
    headerName: 'Date',
    valueFormatter: dateFormatter,
    filter: false,
  },
]

export const defaultSortModel = [{ field: 'createDate', direction: 'desc' }]
