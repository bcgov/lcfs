export const ROUTES = {
  // Auth routes
  AUTH: {
    LOGIN: '/login',
    UNAUTHORIZED: '/unauthorized',
    LOG_OUT: '/log-out'
  },

  // Core routes
  DASHBOARD: '/',
  API_DOCS: '/docs',
  FILE_SUBMISSION: '/file-submissions',

  // Transaction routes
  TRANSACTIONS: {
    LIST: '/transactions',
    ADD: '/transactions/add',
    EDIT: '/transactions/edit/:transactionId',
    VIEW: '/transactions/:transactionId',
    ADMIN_ADJUSTMENT: {
      VIEW: '/admin-adjustment/:transactionId',
      ORG_VIEW: '/org-admin-adjustment/:transactionId',
      EDIT: '/admin-adjustment/edit/:transactionId'
    },
    INITIATIVE_AGREEMENT: {
      VIEW: '/initiative-agreement/:transactionId',
      ORG_VIEW: '/org-initiative-agreement/:transactionId',
      EDIT: '/initiative-agreement/edit/:transactionId'
    }
  },

  // Transfer routes
  TRANSFERS: {
    LIST: '/transfers',
    ADD: '/transfers/add',
    EDIT: '/transfers/edit/:transferId',
    VIEW: '/transfers/:transferId'
  },

  // Organization routes
  ORGANIZATION: {
    ORG: '/organization',
    ADD_USER: '/organization/add-user',
    VIEW_USER: '/organization/:userID',
    EDIT_USER: '/organization/:userID/edit-user'
  },

  ORGANIZATIONS: {
    LIST: '/organizations',
    ADD: '/organizations/add-org',
    VIEW: '/organizations/:orgID',
    EDIT: '/organizations/:orgID/edit-org',
    ADD_USER: '/organizations/:orgID/add-user',
    VIEW_USER: '/organizations/:orgID/:userID',
    EDIT_USER: '/organizations/:orgID/:userID/edit-user'
  },

  // Compliance reporting routes
  REPORTS: {
    LIST: '/compliance-reporting',
    VIEW: '/compliance-reporting/:compliancePeriod/:complianceReportId',
    COMPARE: '/compare-reporting',
    ADD: {
      SUPPLY_OF_FUEL:
        '/compliance-reporting/:compliancePeriod/:complianceReportId/supply-of-fuel',
      FINAL_SUPPLY_EQUIPMENTS:
        '/compliance-reporting/:compliancePeriod/:complianceReportId/final-supply-equipments',
      ALLOCATION_AGREEMENTS:
        '/compliance-reporting/:compliancePeriod/:complianceReportId/allocation-agreements',
      NOTIONAL_TRANSFERS:
        '/compliance-reporting/:compliancePeriod/:complianceReportId/notional-transfers',
      OTHER_USE_FUELS:
        '/compliance-reporting/:compliancePeriod/:complianceReportId/fuels-other-use',
      FUEL_EXPORTS:
        '/compliance-reporting/:compliancePeriod/:complianceReportId/fuel-exports'
    },
    CHANGELOG: {
      SUPPLY_OF_FUEL:
        '/compliance-reporting/:compliancePeriod/:complianceReportId/supply-of-fuel/changelog',
      NOTIONAL_TRANSFERS:
        '/compliance-reporting/:compliancePeriod/:complianceReportId/notional-transfers/changelog',
      OTHER_USE_FUELS:
        '/compliance-reporting/:compliancePeriod/:complianceReportId/fuels-other-use/changelog',
      FUEL_EXPORTS:
        '/compliance-reporting/:compliancePeriod/:complianceReportId/fuel-exports/changelog',
      ALLOCATION_AGREEMENTS:
        '/compliance-reporting/:compliancePeriod/:complianceReportId/allocation-agreements/changelog'
    }
  },

  // Notification routes
  NOTIFICATIONS: {
    LIST: '/notifications',
    SETTINGS: '/notifications/configure'
  },

  // Admin routes
  ADMIN: {
    MAIN: '/admin',
    USERS: {
      LIST: '/admin/users',
      ADD: '/admin/users/add-user',
      VIEW: '/admin/users/:userID',
      EDIT: '/admin/users/:userID/edit-user'
    },
    USER_ACTIVITY: '/admin/user-activity',
    USER_LOGIN_HISTORY: '/admin/user-login-history',
    AUDIT_LOG: {
      LIST: '/admin/audit-log',
      VIEW: '/admin/audit-log/:auditLogId'
    }
  },

  // Fuel code routes
  FUEL_CODES: {
    LIST: '/fuel-codes',
    ADD: '/fuel-codes/add-fuel-code',
    EDIT: '/fuel-codes/:fuelCodeID'
  }
}

// Helper function to generate paths with parameters
export const generatePath = {
  organizationView: (orgId) =>
    ROUTES.ORGANIZATIONS.VIEW.replace(':orgID', orgId),
  organizationUserView: (orgId, userId) =>
    ROUTES.ORGANIZATIONS.VIEW_USER.replace(':orgID', orgId).replace(
      ':userID',
      userId
    ),
  transactionView: (transactionId) =>
    ROUTES.TRANSACTIONS.VIEW.replace(':transactionId', transactionId),
  reportView: (period, reportId) =>
    ROUTES.REPORTS.VIEW.replace(':compliancePeriod', period).replace(
      ':complianceReportId',
      reportId
    ),
  auditLogView: (logId) =>
    ROUTES.ADMIN.AUDIT_LOG.VIEW.replace(':auditLogId', logId)
}

export default ROUTES
