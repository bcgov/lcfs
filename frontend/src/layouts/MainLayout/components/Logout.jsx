import { logout } from '@/utils/keycloak'
import { useKeycloak } from '@react-keycloak/web'
import { useTranslation } from 'react-i18next'
// @mui components
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { useScrollTrigger } from '@mui/material'

import { useCurrentUser } from '@/hooks/useCurrentUser'
import { PropTypes } from 'prop-types'

export const Logout = (props) => {
  const { t } = useTranslation()
  const { data: currentUser } = useCurrentUser()
  const { keycloak } = useKeycloak()
  const isScrolled = useScrollTrigger()

  return (
    keycloak.authenticated && (
      <BCBox
        display="flex"
        alignItems="right"
        justifyContent="space-around"
        mr={2}
      >
        {currentUser?.firstName && (
          <BCTypography
            variant="subtitle1"
            color={isScrolled ? 'primary' : 'light'}
            mx={1}
          >
            {currentUser?.firstName + ' ' + currentUser?.lastName}
          </BCTypography>
        )}
        <BCButton
          onClick={() => {
            logout()
          }}
          color={isScrolled ? 'primary' : 'light'}
          size="small"
          variant={isScrolled ? 'contained' : 'outlined'}
          data-test="logout-button"
        >
          {t('logout')}
        </BCButton>
      </BCBox>
    )
  )
}

Logout.propTypes = {
  isScrolled: PropTypes.bool
}
