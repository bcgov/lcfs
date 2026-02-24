import {
  numberFormatter,
  phoneNumberFormatter,
  timezoneFormatter
} from '@/utils/formatters'
import { BCDateFloatingFilter } from '@/components/BCDataGrid/components/index'
import { RoleRenderer } from '@/utils/grid/cellRenderers'

// Column definitions for the credit trading market table
export const creditMarketColDefs = (t) => [
  {
    headerName: t('creditMarket:organizationName', 'Organization name'),
    field: 'organizationName',
    flex: 2,
    minWidth: 200,
    sortable: true,
    filter: 'agTextColumnFilter',
    floatingFilter: true
  },
  {
    headerName: t('creditMarket:creditsToSell', 'Credits to sell'),
    field: 'creditsToSell',
    flex: 1,
    minWidth: 160,
    sortable: true,
    filter: 'agNumberColumnFilter',
    floatingFilter: true,
    valueGetter: (params) => {
      // Show N/A if credits to sell is 0, null, or undefined
      if (
        params.data.creditsToSell === null ||
        params.data.creditsToSell === undefined ||
        params.data.creditsToSell === 0
      ) {
        return 'N/A'
      }
      return parseInt(params.data.creditsToSell)
    },
    valueFormatter: numberFormatter
  },
  {
    headerName: t('creditMarket:roleInMarket', 'Role in market'),
    field: 'roleInMarket',
    flex: 1.5,
    minWidth: 220,
    sortable: true,
    filter: 'agSetColumnFilter',
    floatingFilter: true,
    cellRenderer: (params) => {
      const roles = []
      if (params.data.isSeller) roles.push('Seller')
      if (params.data.isBuyer) roles.push('Buyer')
      return roles.length > 0 ? (
        <RoleRenderer value={roles} disableLink={true} />
      ) : (
        'N/A'
      )
    }
  },
  {
    headerName: t('creditMarket:contactPerson', 'Name'),
    field: 'contactPerson',
    flex: 1.5,
    minWidth: 150,
    sortable: true,
    filter: 'agTextColumnFilter',
    floatingFilter: true
  },
  {
    headerName: t('creditMarket:phone', 'Phone'),
    field: 'phone',
    flex: 1.5,
    minWidth: 150,
    sortable: true,
    filter: 'agTextColumnFilter',
    valueFormatter: phoneNumberFormatter,
    floatingFilter: true
  },
  {
    headerName: t('creditMarket:email', 'Email'),
    field: 'email',
    flex: 2,
    minWidth: 200,
    sortable: true,
    filter: 'agTextColumnFilter',
    floatingFilter: true
  }
]

export const defaultSortModel = [
  {
    colId: 'organizationName',
    sort: 'asc'
  }
]

export const creditMarketAuditLogColDefs = (t) => [
  {
    headerName: t('creditMarket:organizationName', 'Organization name'),
    field: 'organizationName',
    flex: 2,
    minWidth: 200,
    sortable: true,
    filter: 'agTextColumnFilter',
    floatingFilter: true
  },
  {
    headerName: t('creditMarket:creditsToSell', 'Credits to sell'),
    field: 'creditsToSell',
    flex: 1,
    minWidth: 150,
    sortable: true,
    filter: 'agNumberColumnFilter',
    floatingFilter: true,
    valueFormatter: numberFormatter
  },
  {
    headerName: t('creditMarket:roleInMarket', 'Role in market'),
    field: 'roleInMarket',
    flex: 1.5,
    minWidth: 180,
    sortable: true,
    filter: false,
    floatingFilter: false,
    cellRenderer: (params) => {
      const roles = String(params.value || '')
        .split(',')
        .map((role) => role.trim())
        .filter(Boolean)

      return roles.length > 0 ? (
        <RoleRenderer value={roles} disableLink={true} />
      ) : (
        'N/A'
      )
    }
  },
  {
    headerName: t('creditMarket:contactPerson', 'Contact person'),
    field: 'contactPerson',
    flex: 1.5,
    minWidth: 180,
    sortable: true,
    filter: 'agTextColumnFilter',
    floatingFilter: true
  },
  {
    headerName: t('creditMarket:phone', 'Phone'),
    field: 'phone',
    flex: 1.2,
    minWidth: 150,
    sortable: true,
    filter: 'agTextColumnFilter',
    valueFormatter: phoneNumberFormatter,
    floatingFilter: true
  },
  {
    headerName: t('creditMarket:email', 'Email'),
    field: 'email',
    flex: 2,
    minWidth: 220,
    sortable: true,
    filter: 'agTextColumnFilter',
    floatingFilter: true
  },
  {
    headerName: t('creditMarket:changedBy', 'Changed by'),
    field: 'changedBy',
    flex: 1.5,
    minWidth: 180,
    sortable: true,
    filter: 'agTextColumnFilter',
    floatingFilter: true
  },
  {
    headerName: t('creditMarket:uploadedDate', 'Uploaded date'),
    field: 'uploadedDate',
    flex: 1.7,
    minWidth: 220,
    sortable: true,
    cellDataType: 'dateString',
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

export const defaultAuditSortModel = [{ field: 'uploadedDate', direction: 'desc' }]
