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
    minWidth: 120,
    sortable: true,
    filter: 'agNumberColumnFilter',
    floatingFilter: true,
    cellRenderer: (params) => {
      // Show N/A if credits to sell is 0, null, or undefined
      if (params.value === null || params.value === undefined || params.value === 0) {
        return 'N/A'
      }
      return params.value
    }
  },
  {
    headerName: t('creditMarket:roleInMarket', 'Role in market'),
    field: 'roleInMarket',
    flex: 1.5,
    minWidth: 150,
    sortable: true,
    filter: 'agSetColumnFilter',
    floatingFilter: true,
    cellRenderer: (params) => {
      const roles = []
      if (params.data.isSeller) roles.push('Seller')
      if (params.data.isBuyer) roles.push('Buyer')
      return roles.length > 0 ? roles.join(', ') : 'N/A'
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
    headerName: t('creditMarket:email', 'Email'),
    field: 'email',
    flex: 2,
    minWidth: 200,
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
    floatingFilter: true
  }
]


export const defaultSortModel = [
  {
    colId: 'organizationName',
    sort: 'asc'
  }
]