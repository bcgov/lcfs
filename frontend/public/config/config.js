export const config = {
  api_base: 'http://localhost:8000/api',
  keycloak: {
    REALM: 'standard',
    CLIENT_ID: 'low-carbon-fuel-standard-5147',
    AUTH_URL: 'https://dev.loginproxy.gov.bc.ca/auth',
    POST_LOGOUT_URL: 'http://localhost:3000/',
    SM_LOGOUT_URL:
      'https://logontest7.gov.bc.ca/clp-cgi/logoff.cgi?retnow=1&returl='
  }
}

export default window.lcfs_config = config
