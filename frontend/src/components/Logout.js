import React from 'react';
import { useKeycloak } from '@react-keycloak/web';
import { logout } from '../keycloak'
import BCButton from 'components/BCButton'

const Logout = () => {
  const { keycloak } = useKeycloak();
  if (keycloak.authenticated) {
    const kcToken = keycloak.tokenParsed;
    return (
      <div className="logout">
        <span>{'Logged in as: ' + kcToken.display_name + ' |'}</span>
        <BCButton
          data-test="logout-button"
          onClick={() => {
            logout()
          }}
          color='light'
          size='small'
          variant='outlined'
        >
          Log out
        </BCButton>
      </div>
    );
  }
  return null;
};

export default Logout;
