import Keycloak from 'keycloak-js'
import { CONFIG } from '@/constants/config'

const keycloak = new Keycloak({
  clientId: CONFIG.KEYCLOAK.CLIENT_ID,
  realm: CONFIG.KEYCLOAK.REALM,
  url: CONFIG.KEYCLOAK.AUTH_URL
})

export const keycloakInitOptions = {
  onLoad: 'check-sso',
  pkceMethod: 'S256'
}

export const getKeycloak = () => {
  return keycloak
}

export const logout = () => {
  sessionStorage.removeItem('keycloak-logged-in')

  const keycloakLogoutUrl =
    keycloak.endpoints.logout() +
    '?post_logout_redirect_uri=' +
    CONFIG.KEYCLOAK.POST_LOGOUT_URL +
    '&client_id=' +
    keycloak.clientId +
    '&id_token_hint=' +
    keycloak.idToken

  const url =
    CONFIG.KEYCLOAK.SM_LOGOUT_URL + encodeURIComponent(keycloakLogoutUrl)

  window.location = url
}

export const refreshToken = () => {
  keycloak
    .updateToken(60) // Minimum validity in seconds
    .then((refreshed) => {
      if (refreshed) {
        console.log('Token refreshed')
      }
    })
    .catch(() => {
      console.error('Failed to refresh token')
      logout()
    })
}
