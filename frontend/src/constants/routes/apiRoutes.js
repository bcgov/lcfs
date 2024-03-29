export const apiRoutes = {
  currentUser: '/users/current',
  exportUsers: '/users/export?format=xls',
  listUsers: '/users/list',
  roles: '/roles/',
  orgUsers: '/organization/:orgID/users/list',
  transactions: '/transactions/',
  orgTransactions: '/organization/:orgID/transactions',
}

export const viewRoutesTitle = {
  admin: "Administration",
  "transfers": "Transactions",
  "add-org": "Add organization",
  "edit-org": "Edit organization"
}