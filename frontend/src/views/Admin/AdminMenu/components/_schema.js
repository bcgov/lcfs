import {
  dateFormatter,
  phoneNumberFormatter,
  timezoneFormatter
} from '@/utils/formatters'
import {
  LinkRenderer,
  LoginStatusRenderer,
  RoleRenderer,
  StatusRenderer
} from '@/utils/grid/cellRenderers'
import { useRoleList } from '@/hooks/useRole'
import {
  BCSelectFloatingFilter,
  BCDateFloatingFilter
} from '@/components/BCDataGrid/components/index'
import { RoleSelectFloatingFilter } from './RoleSelectFloatingFilter'
import {
  COMPLIANCE_REPORT_STATUSES,
  TRANSACTION_TYPES,
  TRANSFER_STATUSES
} from '@/constants/statuses'

export const usersColumnDefs = (t) => [
  {
    colId: 'firstName',
    field: 'firstName',
    minWidth: 200,
    headerName: t('admin:userColLabels.userName'),
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
    suppressFloatingFilterButton: true,
    floatingFilterComponent: RoleSelectFloatingFilter,
    floatingFilterComponentParams: {
      params: 'government_roles_only=true',
      valueKey: 'name',
      labelKey: 'name'
    },
    minWidth: 300,
    cellRenderer: RoleRenderer,
    cellClass: 'vertical-middle'
  },
  {
    colId: 'email',
    field: 'keycloakEmail',
    headerName: t('admin:userColLabels.email'),
    minWidth: 300
  },
  {
    colId: 'phone',
    field: 'phone',
    headerName: t('admin:userColLabels.phone'),
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
      textMatcher: () => {
        return true
      }
    },
    cellRenderer: StatusRenderer,
    cellClass: 'vertical-middle',
    floatingFilterComponent: BCSelectFloatingFilter,
    floatingFilterComponentParams: {
      optionsQuery: () => ({
        data: [
          { id: 1, name: t('admin:userColLabels.active') },
          { id: 0, name: t('admin:userColLabels.inactive') }
        ],
        isLoading: false
      }),
      valueKey: 'name',
      labelKey: 'name'
    },
    minWidth: 120,
    suppressFloatingFilterButton: true
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
    floatingFilterComponent: BCSelectFloatingFilter,
    floatingFilterComponentParams: {
      valueKey: 'action',
      labelKey: 'action',
      optionsQuery: () => {
        const allStatuses = [
          ...Object.values(TRANSFER_STATUSES).map((value) => ({
            action: value
          }))
          // ...Object.values(COMPLIANCE_REPORT_STATUSES).map((value) => ({
          //   action: value
          // }))
        ]

        const deduplicatedStatuses = Array.from(
          new Set(allStatuses.map((item) => item.action))
        ).map((action) => ({ action }))

        return {
          data: deduplicatedStatuses,
          isLoading: false
        }
      }
    },
    suppressFloatingFilterButton: true
  },
  {
    colId: 'transactionType',
    field: 'transactionType',
    headerName: 'Transaction Type',
    floatingFilterComponent: BCSelectFloatingFilter,
    floatingFilterComponentParams: {
      valueKey: 'value',
      labelKey: 'label',
      optionsQuery: () => ({
        data: [
          ...Object.values(TRANSACTION_TYPES).map((value) => ({
            label: value.replace(/([A-Z])/g, ' $1').trim(),
            value
          }))
        ],
        isLoading: false
      })
    },
    suppressFloatingFilterButton: true
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
    floatingFilterComponent: BCDateFloatingFilter,
    suppressFloatingFilterButton: true
  }
]

export const userLoginHistoryColDefs = (t) => [
  {
    field: 'userLoginHistoryId',
    headerName: t('admin:userLoginHistoryColLabels.userLoginHistoryId'),
    cellDataType: 'number',
    filter: 'agNumberColumnFilter',
    filterParams: {
      filterOptions: ['startsWith'],
      buttons: ['clear']
    }
  },
  {
    field: 'keycloakEmail',
    headerName: t('admin:userLoginHistoryColLabels.keycloakEmail')
  },
  {
    field: 'externalUsername',
    headerName: t('admin:userLoginHistoryColLabels.externalUsername')
  },
  {
    field: 'isLoginSuccessful',
    headerName: t('admin:userLoginHistoryColLabels.isLoginSuccessful'),
    cellRenderer: LoginStatusRenderer,
    valueGetter: (params) => params.data.isLoginSuccessful,
    filterParams: {
      textMatcher: (filter) => {
        return true
      }
    },
    floatingFilterComponent: BCSelectFloatingFilter,
    floatingFilterComponentParams: {
      optionsQuery: () => ({
        data: [
          { id: 1, name: 'Success' },
          { id: 0, name: 'Failed' }
        ],
        isLoading: false
      }),
      valueKey: 'name',
      labelKey: 'name'
    },
    suppressFloatingFilterButton: true
  },
  {
    field: 'loginErrorMessage',
    headerName: t('admin:userLoginHistoryColLabels.loginErrorMessage')
  },
  {
    field: 'createDate',
    headerName: t('admin:userLoginHistoryColLabels.createDate'),
    cellDataType: 'dateString',
    valueFormatter: timezoneFormatter,
    floatingFilterComponent: BCDateFloatingFilter,
    suppressFloatingFilterButton: true
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
    cellDataType: 'number',
    filter: 'agNumberColumnFilter',
    filterParams: {
      filterOptions: ['startsWith'],
      buttons: ['clear']
    }
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
    },
    floatingFilterComponent: BCDateFloatingFilter,
    suppressFloatingFilterButton: true
  }
]

export const defaultAuditLogSortModel = [
  { field: 'createDate', direction: 'desc' }
]
