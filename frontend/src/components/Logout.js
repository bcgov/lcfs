import React from 'react';
import { useKeycloak } from '@react-keycloak/web';
import { logout } from '../keycloak'

const Logout = () => {
  const { keycloak } = useKeycloak();
  if (keycloak.authenticated) {
    const kcToken = keycloak.tokenParsed;
    return (
      <div className="logout">
        <span>{'Logged in as: ' + kcToken.display_name + ' |'}</span>
        <button
          className="logoutButton"
          onClick={() => {
            logout()
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
