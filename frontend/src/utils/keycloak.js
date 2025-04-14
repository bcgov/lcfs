import Keycloak from 'keycloak-js'
import { CONFIG } from '@/constants/config'

const keycloak = new Keycloak({
  clientId: CONFIG.KEYCLOAK.CLIENT_ID,
  realm: CONFIG.KEYCLOAK.REALM,
  url: CONFIG.KEYCLOAK.AUTH_URL
})

export const getKeycloak = () => {
  return keycloak
}

export const logout = () => {
  localStorage.removeItem('keycloak-logged-in')

  const idToken = keycloak.idToken || keycloak.tokenParsed?.idToken

  if (!idToken) {
    console.error('idToken is not available')
    return
  }
  const keycloakLogoutUrl =
    keycloak.endpoints.logout() +
    '?post_logout_redirect_uri=' +
    CONFIG.KEYCLOAK.POST_LOGOUT_URL +
    '&client_id=' +
    keycloak.clientId +
    '&id_token_hint=' +
    idToken

  const url =
    CONFIG.KEYCLOAK.SM_LOGOUT_URL + encodeURIComponent(keycloakLogoutUrl)

  window.location = url
}
