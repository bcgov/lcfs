export const appRoutes = {
  users: {
    current: 'users/current'
  },
  dashboard: {
    main: 'dashboard'
  },
  document: {
    main: 'document'
  },
  transactions: {
    main: 'transactions'
  },
  complianceReport: {
    main: 'compliance-report'
  },
  organization: {
    main: 'organization',
    users: '/organization/users',
    createUser: '/organization/users/create',
    editUser: '/organization/users/:userID/edit',
    viewUser: '/organization/users/:userID'
  },
  admin: {
    main: 'admin',
    users: '/admin/users',
    createUser: '/admin/users/create',
    editUser: '/admin/users/:userID/edit',
    viewUser: '/admin/users/:userID'
  },
  contactUs: {
    main: 'contact-us'
  },
  login: {
    main: 'login'
  },
  docs: {
    main: 'docs'
  }
}
