export const DASHBOARD = '/'
export const LOGIN = '/login'
export const UNAUTHORIZED = '/unauthorized'

export const TRANSACTIONS = '/transactions'
export const TRANSACTIONS_ADD = `${TRANSACTIONS}/add`
export const TRANSACTIONS_EDIT = `${TRANSACTIONS}/edit/:transactionId`
export const TRANSACTIONS_VIEW = `${TRANSACTIONS}/:transactionId`

export const TRANSFERS = '/transfers'
export const TRANSFERS_ADD = `${TRANSFERS}/add`
export const TRANSFERS_EDIT = `${TRANSFERS}/edit/:transferId`
export const TRANSFERS_VIEW = `${TRANSFERS}/:transferId`

export const TRANSACTION_ADD = '/transaction/add'
export const ADMIN_ADJUSTMENT_VIEW = '/admin-adjustment/:transactionId'
export const ORG_ADMIN_ADJUSTMENT_VIEW = '/org-admin-adjustment/:transactionId'
export const ADMIN_ADJUSTMENT_EDIT = '/admin-adjustment/edit/:transactionId'
export const INITIATIVE_AGREEMENT_VIEW = '/initiative-agreement/:transactionId'
export const ORG_INITIATIVE_AGREEMENT_VIEW =
  '/org-initiative-agreement/:transactionId'
export const INITIATIVE_AGREEMENT_EDIT =
  '/initiative-agreement/edit/:transactionId'

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

export const REPORTS = '/compliance-reporting'
export const REPORTS_VIEW = `${REPORTS}/:compliancePeriod/:complianceReportId`
export const REPORTS_ADD_SUPPLY_OF_FUEL = `${REPORTS_VIEW}/supply-of-fuel`
export const REPORTS_ADD_FINAL_SUPPLY_EQUIPMENTS = `${REPORTS_VIEW}/final-supply-equipments`
export const REPORTS_ADD_ALLOCATION_AGREEMENTS = `${REPORTS_VIEW}/allocation-agreements`
export const REPORTS_ADD_NOTIONAL_TRANSFERS = `${REPORTS_VIEW}/notional-transfers`
export const REPORTS_ADD_OTHER_USE_FUELS = `${REPORTS_VIEW}/fuels-other-use`
export const REPORTS_ADD_FUEL_EXPORTS = `${REPORTS_VIEW}/fuel-exports`

export const NOTIFICATIONS = '/notifications'
export const NOTIFICATIONS_SETTINGS = `${NOTIFICATIONS}/configure`

export const ADMIN = '/admin'
export const ADMIN_USERS = `${ADMIN}/users`
export const ADMIN_USERS_ADD = `${ADMIN_USERS}/add-user`
export const ADMIN_USERS_VIEW = `${ADMIN_USERS}/:userID`
export const ADMIN_USERS_EDIT = `${ADMIN_USERS_VIEW}/edit-user`
export const ADMIN_USERACTIVITY = `${ADMIN}/user-activity`
export const ADMIN_COMPLIANCE_REPORTING = `${ADMIN}/compliance-reporting`
export const ADMIN_USER_LOGIN_HISTORY = `${ADMIN}/user-login-history`
export const ADMIN_AUDIT_LOG = `${ADMIN}/audit-log`
export const ADMIN_AUDIT_LOG_VIEW = `${ADMIN_AUDIT_LOG}/:auditLogId`

export const FUELCODES = '/fuel-codes'
export const FUELCODES_ADD = `${FUELCODES}/add-fuel-code`
export const FUELCODES_EDIT = `${FUELCODES}/:fuelCodeID`

export const FILESUBMISSION = '/file-submissions' // might not need

export const APIDOCS = '/docs'
export const LOG_OUT = '/log-out'
