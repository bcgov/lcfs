/*
 Used to track feature configuration
*/
const getConfig = (value, def) => {
  if (window.lcfs_config) {
    return window.lcfs_config[value] || def
  }
  return def
}

function getApiBaseUrl() {
  // Split the hostname
  const hostnameParts = window.location.hostname.split('.')

  // Check if the environment is local development
  let baseUrl
  if (window.location.hostname === 'localhost') {
    // In local development, use port 8000
    baseUrl = `${window.location.protocol}//localhost:8000/api`
  } else {
    // Determine the environment part of the subdomain
    const subDomain = hostnameParts[0]
    const envPart = subDomain.split('-')[1]

    // Check if the environment is 'dev' or 'test', otherwise default to production
    if (envPart === 'dev' || envPart === 'test') {
      baseUrl = `${
        window.location.protocol
      }//lcfs-backend-${envPart}.${hostnameParts.slice(1).join('.')}/api`
    } else {
      // Production environment
      baseUrl = `${window.location.protocol}//lcfs-backend.${hostnameParts
        .slice(1)
        .join('.')}/api`
    }
  }

  // Use getConfig to get 'api_base' from configuration or fallback to baseUrl
  return getConfig('api_base', baseUrl)
}

export const CONFIG = {
  API_BASE: getApiBaseUrl(),
  // KEYCLOAK: {
  //   REALM: getConfig('keycloak.realm', 'standard'),
  //   CLIENT_ID: getConfig('keycloak.client_id', 'low-carbon-fuel-standard-5147'),
  //   AUTH_URL: getConfig(
  //     'keycloak.auth_url',
  //     'https://dev.loginproxy.gov.bc.ca/auth'
  //   ),
  //   POST_LOGOUT_URL: getConfig(
  //     'keycloak.post_logout_url',
  //     'http://localhost:3000/'
  //   ),
  //   SM_LOGOUT_URL: getConfig(
  //     'keycloak.siteminder_logout_url',
  //     'https://logontest7.gov.bc.ca/clp-cgi/logoff.cgi?retnow=1&returl='
  //   )
  // },
  KEYCLOAK: {
    REALM: import.meta.env.VITE_KEYCLOAK_REALM ?? 'standard',
    CLIENT_ID:
      import.meta.env.VITE_KEYCLOAK_CLIENT_ID ??
      'low-carbon-fuel-standard-5147',
    AUTH_URL:
      import.meta.env.VITE_KEYCLOAK_AUTH_URL ??
      'https://dev.loginproxy.gov.bc.ca/auth',
    POST_LOGOUT_URL:
      import.meta.env.VITE_KEYCLOAK_POST_LOGOUT_URL ?? 'http://localhost:3000/',
    SM_LOGOUT_URL:
      import.meta.env.VITE_KEYCLOAK_SM_LOGOUT_URL ??
      'https://logontest7.gov.bc.ca/clp-cgi/logoff.cgi?retnow=1&returl='
  }
}
