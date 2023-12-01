/*
 Used to track feature configuration
*/
const getConfig = (value, def) => {
  if (window.lcfs_config) {
    return window.lcfs_config[value] || def
  }
  return def
}

function getApiBaseUrl () {
  // Split the hostname and current port (if any)
  const [hostname] = window.location.hostname.split(':')

  // Construct the new base URL with port 8000
  const baseUrl = `${window.location.protocol}//${hostname}:8000/api`

  // Use getConfig to get 'api_base' from configuration or fallback to baseUrl
  return getConfig('api_base', baseUrl)
}

const CONFIG = {
  API_BASE: getApiBaseUrl(),
  KEYCLOAK: {
    REALM: getConfig('keycloak.realm', 'standard'),
    CLIENT_ID: getConfig('keycloak.client_id', 'tfrs-on-gold-4308'),
    AUTH_URL: getConfig('keycloak.auth_url', 'https://dev.loginproxy.gov.bc.ca/auth'),
    CALLBACK_URL: getConfig('keycloak.callback_url', 'unconfigured'),
    POST_LOGOUT_URL: getConfig('keycloak.post_logout_url', 'http://localhost:3000/'),
    SM_LOGOUT_URL: getConfig('keycloak.siteminder_logout_url', 'https://logontest7.gov.bc.ca/clp-cgi/logoff.cgi?retnow=1&returl=')
  },
  DEBUG: {
    ENABLED: getConfig('debug.enabled', false)
  },
  SECURE_DOCUMENT_UPLOAD: {
    ENABLED: getConfig('secure_document_upload.enabled', false),
    MAX_FILE_SIZE: getConfig('secure_document_upload.max_file_size', 50000000)
  },
  FUEL_CODES: {
    ENABLED: getConfig('fuel_codes.enabled', false)
  },
  CREDIT_TRANSFER: {
    ENABLED: getConfig('credit_transfer.enabled', false)
  },
  COMPLIANCE_REPORTING: {
    ENABLED: getConfig('compliance_reporting.enabled', false),
    CREATE_EFFECTIVE_DATE: getConfig('compliance_reporting.create_effective_date', '2013-07-01')
  },
  CREDIT_CALCULATION_API: {
    ENABLED: getConfig('credit_calculation_api.enabled', false)
  },
  EXCLUSION_REPORTS: {
    ENABLED: getConfig('exclusion_reports.enabled', false),
    CREATE_EFFECTIVE_DATE: getConfig('exclusion_reports.create_effective_date', '2013-07-01')
  }
}

export default CONFIG
