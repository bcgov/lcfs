export const apiRoutes = {
  currentUser: '/users/current',
  exportUsers: '/users/export?format=xls',
  listUsers: '/users/list',
  roles: '/roles/',
  orgUsers: '/organization/:orgID/users/list',
  transactions: '/transactions/',
  orgTransactions: '/organization/:orgID/transactions',
  openapi: '/openapi.json/',
  updateCategory: '/transfers/:transferId/category',
  getTransfer: '/transfers/:transferId',
  getFuelCode: '/fuel-code/:fuelCodeId',
  fuelCodeOptions: '/fuel-code/table-options'
}

export const viewRoutesTitle = {
  admin: 'Administration',
  transfers: 'Transactions',
  'add-org': 'Add organization',
  'edit-org': 'Edit organization'
}
