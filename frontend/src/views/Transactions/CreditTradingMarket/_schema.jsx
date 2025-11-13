import { numberFormatter, phoneNumberFormatter } from '@/utils/formatters'
import { RoleRenderer } from '@/utils/grid/cellRenderers'

// Column definitions for the credit trading market table
export const creditMarketColDefs = (t) => [
  {
    headerName: t('creditMarket:organizationName', 'Organization Name'),
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
