import React from 'react';
import { useKeycloak } from '@react-keycloak/web';

const Logout = ({ logoutUri }) => {
  const { keycloak } = useKeycloak();
  if (keycloak.authenticated) {
    const kcToken = keycloak.tokenParsed;
    return (
      <div className="logout">
        <span>{'Logged in as: ' + kcToken.display_name + ' |'}</span>
        <button
          className="logoutButton"
          onClick={() => {
            if (logoutUri) {
              keycloak.logout({ redirectUri: logoutUri });
            } else {
              keycloak.logout();
            }
          }}
        >
          Log out
        </button>
      </div>
    );
  }
  return null;
};

export default Logout;
