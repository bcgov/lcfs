export const DASHBOARD = '/'
export const LOGIN = '/login'

export const TRANSACTIONS = '/transactions'
export const TRANSACTIONS_VIEW = `${TRANSACTIONS}/:transactionID`

export const TRANSFERS = '/transfers'
export const TRANSFERS_ADD = `${TRANSFERS}/add`
export const TRANSFERS_EDIT = `${TRANSFERS}/edit/:transferId`
export const TRANSFERS_VIEW = `${TRANSFERS}/:transferId`

export const ORGANIZATION = '/organization'
export const ORGANIZATION_ADDUSER = `${ORGANIZATION}/add-user`
export const ORGANIZATION_VIEWUSER = `${ORGANIZATION}/:userID`
export const ORGANIZATION_EDITUSER = `${ORGANIZATION_VIEWUSER}/edit-user`

export const ORGANIZATIONS = '/organizations'
export const ORGANIZATIONS_ADD = `${ORGANIZATIONS}/add-org`
export const ORGANIZATIONS_VIEW = `${ORGANIZATIONS}/:orgID`
export const ORGANIZATIONS_EDIT = `${ORGANIZATIONS_VIEW}/edit-org`
export const ORGANIZATIONS_ADDUSER = `${ORGANIZATIONS_VIEW}/add-user`
export const ORGANIZATIONS_VIEWUSER = `${ORGANIZATIONS_VIEW}/:userID`
export const ORGANIZATIONS_EDITUSER = `${ORGANIZATIONS_VIEWUSER}/edit-user`

export const REPORTS = '/reports'
export const REPORTS_VIEW = `${REPORTS}/:reportID`

export const NOTIFICATIONS = '/notifications'
export const NOTIFICATIONS_SETTINGS = `${NOTIFICATIONS}/settings`

export const ADMIN = '/admin'
export const ADMIN_USERS = `${ADMIN}/users`
export const ADMIN_USERS_ADD = `${ADMIN_USERS}/add-user`
export const ADMIN_USERS_VIEW = `${ADMIN_USERS}/:userID`
export const ADMIN_USERS_EDIT = `${ADMIN_USERS_VIEW}/edit-user`
export const ADMIN_USERACTIVITY = `${ADMIN}/user-activity`
export const ADMIN_FUEL_CODES = `${ADMIN}/fuel-codes`
export const ADMIN_COMPLIANCE_REPORTING = `${ADMIN}/compliance-reporting`

export const FUELCODES = '/fuel-codes'
export const FUELCODES_ADD = `${FUELCODES}/add-fuel-code`

export const FSE = '/fse' // might not need

export const FILESUBMISSION = '/file-submissions' // might not need

export const APIDOCS = '/docs'
export const CONTACT_US = '/contact-us'
