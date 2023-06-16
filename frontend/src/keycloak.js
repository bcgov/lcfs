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
