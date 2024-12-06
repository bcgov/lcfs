import {
  phoneNumberFormatter,
  dateFormatter,
  timezoneFormatter
} from '@/utils/formatters'
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
    headerName: 'Transaction ID',
    valueGetter: (params) => {
      const transactionType = params.data.transactionType
      const prefix = prefixMap[transactionType] || ''
      return `${prefix}${params.data.transactionId}`
    }
  },
  {
    colId: 'createDate',
    field: 'createDate',
    headerName: 'Date',
    valueFormatter: dateFormatter,
    filter: false
  }
]

export const userLoginHistoryColDefs = (t) => [
  {
    field: 'userLoginHistoryId',
    headerName: t('admin:userLoginHistoryColLabels.userLoginHistoryId'),
    cellDataType: 'number'
  },
  {
    field: 'keycloakEmail',
    headerName: t('admin:userLoginHistoryColLabels.keycloakEmail'),
    cellDataType: 'string'
  },
  {
    field: 'keycloakUserId',
    headerName: t('admin:userLoginHistoryColLabels.keycloakUserId'),
    cellDataType: 'string'
  },
  {
    field: 'externalUsername',
    headerName: t('admin:userLoginHistoryColLabels.externalUsername'),
    cellDataType: 'string'
  },
  {
    field: 'isLoginSuccessful',
    headerName: t('admin:userLoginHistoryColLabels.isLoginSuccessful'),
    cellDataType: 'boolean'
  },
  {
    field: 'loginErrorMessage',
    headerName: t('admin:userLoginHistoryColLabels.loginErrorMessage'),
    cellDataType: 'string'
  },
  {
    field: 'createDate',
    headerName: t('admin:userLoginHistoryColLabels.createDate'),
    cellDataType: 'dateString',
    valueFormatter: timezoneFormatter
  }
]

export const defaultSortModel = [{ field: 'createDate', direction: 'desc' }]

export const auditLogColDefs = (t) => [
  {
    colId: 'createUser',
    field: 'createUser',
    headerName: t('admin:auditLogColLabels.userId'),
    minWidth: 150,
    sortable: true,
    filter: 'agTextColumnFilter'
  },
  {
    colId: 'tableName',
    field: 'tableName',
    headerName: t('admin:auditLogColLabels.tableName'),
    minWidth: 150,
    sortable: true,
    filter: 'agTextColumnFilter'
  },
  {
    colId: 'operation',
    field: 'operation',
    headerName: t('admin:auditLogColLabels.operation'),
    minWidth: 150,
    sortable: true,
    filter: 'agTextColumnFilter'
  },
  {
    colId: 'rowId',
    field: 'rowId',
    headerName: t('admin:auditLogColLabels.rowId'),
    minWidth: 100,
    sortable: true,
    filter: 'agTextColumnFilter'
  },
  {
    colId: 'changedFields',
    field: 'changedFields',
    headerName: t('admin:auditLogColLabels.changedFields'),
    minWidth: 300,
    sortable: false,
    filter: false
  },
  {
    colId: 'createDate',
    field: 'createDate',
    cellDataType: 'dateString',
    headerName: t('admin:auditLogColLabels.createDate'),
    flex: 1,
    valueGetter: ({ data }) => data.createDate || '',
    valueFormatter: timezoneFormatter,
    filter: 'agDateColumnFilter',
    filterParams: {
      filterOptions: ['equals', 'lessThan', 'greaterThan', 'inRange'],
      suppressAndOrCondition: true,
      buttons: ['clear']
    }
  }
]

export const defaultAuditLogSortModel = [
  { field: 'createDate', direction: 'desc' }
]
