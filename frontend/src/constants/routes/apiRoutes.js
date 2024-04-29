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
  getFuelCode: '/fuel-codes/:fuelCodeId',
  fuelCodeOptions: '/fuel-codes/table-options',
  addFuelCodes: '/fuel-codes/save-fuel-codes'
}

export const viewRoutesTitle = {
  admin: 'Administration',
  transfers: 'Transactions',
  'add-org': 'Add organization',
  'edit-org': 'Edit organization'
}
