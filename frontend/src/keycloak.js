import Keycloak from 'keycloak-js';
import CONFIG from './config';

const keycloak = new Keycloak({
  clientId: CONFIG.KEYCLOAK.CLIENT_ID,
  realm: CONFIG.KEYCLOAK.REALM,
  url: CONFIG.KEYCLOAK.AUTH_URL
});

export const keycloakInitOptions = {
  onLoad: 'check-sso',
  pkceMethod: 'S256'
};

export const getKeycloak = () => {
  return keycloak
};

export const logout = () => {
  const keycloakLogoutUrl = keycloak.endpoints.logout() +
    '?post_logout_redirect_uri=' + CONFIG.KEYCLOAK.POST_LOGOUT_URL +
    '&client_id=' + keycloak.clientId +
    '&id_token_hint=' + keycloak.idToken

  const url = CONFIG.KEYCLOAK.SM_LOGOUT_URL + encodeURIComponent(keycloakLogoutUrl)
  
  window.location = url
}