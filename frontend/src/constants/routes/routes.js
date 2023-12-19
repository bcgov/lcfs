export const DASHBOARD = '/'
export const LOGIN = '/login'

export const TRANSACTIONS = '/transactions'
export const TRANSACTIONS_NEW = `${TRANSACTIONS}/new`
export const TRANSACTIONS_VIEW = `${TRANSACTIONS}/:transactionID`

export const ORGANIZATION = '/organization'
export const ORGANIZATION_NEWUSER = `${ORGANIZATION}/new-user`
export const ORGANIZATION_VIEWUSER = `${ORGANIZATION}/:userID`
export const ORGANIZATION_EDITUSER = `${ORGANIZATION_VIEWUSER}/edit-user`

export const ORGANIZATIONS = '/organizations'
export const ORGANIZATIONS_NEW = `${ORGANIZATIONS}/new-org`
export const ORGANIZATIONS_VIEW = `${ORGANIZATIONS}/:orgID`
export const ORGANIZATIONS_EDIT = `${ORGANIZATIONS_VIEW}/edit-org`
export const ORGANIZATIONS_NEWUSER = `${ORGANIZATIONS_VIEW}/new-user`
export const ORGANIZATIONS_VIEWUSER = `${ORGANIZATIONS_VIEW}/:userID`
export const ORGANIZATIONS_EDITUSER = `${ORGANIZATIONS_VIEWUSER}/edit-user`

export const REPORTS = '/reports'
export const REPORTS_VIEW = `${REPORTS}/:reportID`

export const NOTIFICATIONS = '/notifications'
export const NOTIFICATIONS_SETTINGS = `${NOTIFICATIONS}/settings`

export const ADMIN = '/admin'
export const ADMIN_USERS = `${ADMIN}/users`
export const ADMIN_USERS_NEW = `${ADMIN_USERS}/new-user`
export const ADMIN_USERS_VIEW = `${ADMIN_USERS}/:userID`
export const ADMIN_USERS_EDIT = `${ADMIN_USERS_VIEW}/edit-user`
export const ADMIN_USERACTIVITY = `${ADMIN}/user-activity`

export const FUELCODES = '/fuel-codes'
export const FUELCODES_NEW = `${FUELCODES}/new-fuel-code`

export const FSE = '/fse' // might not need

export const FILESUBMISSION = 'file-submission' // might not need

export const APIDOCS = '/docs'
