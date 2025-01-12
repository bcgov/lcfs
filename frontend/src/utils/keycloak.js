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
  // Attempt to update the token if it will expire in the next 60 seconds
  keycloak
    .updateToken(60) // Minimum validity in seconds
    .then((refreshed) => {
      if (refreshed) {
        // Token was refreshed successfully
        console.log('Token refreshed')
      } else {
        // Token is still valid, log the remaining time
        // console.log(
        //   'Token not refreshed, valid for',
        //   Math.round(
        //     keycloak.tokenParsed.exp +
        //       keycloak.timeSkew -
        //       new Date().getTime() / 1000
        //   ),
        //   'seconds'
        // )
      }
    })
    .catch(() => {
      // Failed to refresh the token, log the error and logout the user
      console.error('Failed to refresh token')
      logout()
    })
}
