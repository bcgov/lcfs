export function getApiBaseUrl() {
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
  console.log(baseUrl)
  // Use getConfig to get 'api_base' from configuration or fallback to baseUrl
  return window.lcfs_config.api_base ?? baseUrl
}

export const CONFIG = {
  API_BASE: getApiBaseUrl(),
  KEYCLOAK: {
    REALM: window.lcfs_config.keycloak.REALM ?? 'standard',
    CLIENT_ID:
      window.lcfs_config.keycloak.CLIENT_ID ?? 'low-carbon-fuel-standard-5147',
    AUTH_URL:
      window.lcfs_config.keycloak.AUTH_URL ??
      'https://dev.loginproxy.gov.bc.ca/auth',
    POST_LOGOUT_URL:
      window.lcfs_config.keycloak.POST_LOGOUT_URL ?? 'http://localhost:3000/',
    SM_LOGOUT_URL:
      window.lcfs_config.keycloak.SM_LOGOUT_URL ??
      'https://logontest7.gov.bc.ca/clp-cgi/logoff.cgi?retnow=1&returl='
  }
}
