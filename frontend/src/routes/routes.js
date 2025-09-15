/**
 * This file contains all the routes used in the application.
 */

export const ROUTES = {
  DASHBOARD: '/',
  API_DOCS: '/docs',
  CREDIT_CALCULATOR: '/credit-calculator',
  FILE_SUBMISSION: '/file-submissions',

  AUTH: {
    LOGIN: '/login',
    UNAUTHORIZED: '/unauthorized',
    LOG_OUT: '/log-out'
  },

  TRANSACTIONS: {
    LIST: '/transactions',
    LIST_HIGHLIGHTED: '/transactions/?hid=:hid',
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

  TRANSFERS: {
    LIST: '/transfers',
    ADD: '/transfers/add',
    EDIT: '/transfers/edit/:transferId',
    VIEW: '/transfers/:transferId'
  },

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

  REPORTS: {
    LIST: '/compliance-reporting',
    VIEW: '/compliance-reporting/:compliancePeriod/:complianceReportId',
    COMPARE: '/compare-reporting',
    CALCULATOR: '/compliance-reporting/credit-calculator',
    CHARGING_SITE: {
      INDEX: '/compliance-reporting/manage-charging-sites',
      VIEW: '/compliance-reporting/manage-charging-sites/:chargingSiteId',
      EDIT: '/compliance-reporting/manage-charging-sites/:chargingSiteId/edit',
      ADD: '/compliance-reporting/manage-charging-sites/add'
    },
    MANAGE_FSE: '/compliance-reporting/manage-fse',
    ADD_FSE: '/compliance-reporting/manage-fse/add',
    EDIT_FSE: '/compliance-reporting/manage-fse/:fseId/edit',
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
    }
  },

  NOTIFICATIONS: {
    LIST: '/notifications',
    SETTINGS: '/notifications/configure'
  },

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

  FUEL_CODES: {
    LIST: '/fuel-codes',
    ADD: '/fuel-codes/add-fuel-code',
    EDIT: '/fuel-codes/:fuelCodeID',
    EXPORT: '/fuel-codes/export'
  },


  FORMS: {
    VIEW: '/forms/:formSlug/:linkKey',
    VIEW_AUTHENTICATED: '/forms/:formSlug'
  }
}

/**
 * Generates a path by replacing :key placeholders with param values.
 *
 * @param {string} route - The base route with placeholders.
 * @param {Object} [params={}] - Key-value pairs for replacements.
 * @returns {string} Modified route.
 */
export function buildPath(route, params = {}) {
  return Object.entries(params).reduce((result, [key, value]) => {
    return result.replace(`:${key}`, value)
  }, route)
}

export default ROUTES
