import React from 'react';
import { useKeycloak } from '@react-keycloak/web';
import { logout } from '@/keycloak'
import BCButton from 'components/BCButton'
import BCTypography from 'components/BCTypography'
import BCBox from 'components/BCBox';
import { PropTypes } from 'prop-types';
import useUserStore from '@/store/useUserStore'

const Logout = (props) => {
  const user = useUserStore((state) => state.user)
  const { keycloak } = useKeycloak();
  const { isScrolled } = props;

  return (keycloak.authenticated &&
    <BCBox display="flex" alignItems="right" justifyContent="space-around">
      <BCTypography
        variant="subtitle1"
        color={props.isScrolled ? 'primary' : 'light'}
        mx={1}
      >
        {user.display_name}
      </BCTypography>
      <BCButton
        onClick={() => {
          logout()
        }}
        color={isScrolled ? 'primary' : 'light'}
        size='small'
        variant={isScrolled ? 'contained' : 'outlined'}
      >
        Log out
      </BCButton>
    </BCBox>
  );
}

Logout.propTypes = {
  isScrolled: PropTypes.bool,
}

export default Logout;
