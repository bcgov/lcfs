import { logout } from '@/utils/keycloak'
import { useKeycloak } from '@react-keycloak/web'
import { useTranslation } from 'react-i18next'
// @mui components
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'

import { useCurrentUser } from '@/hooks/useCurrentUser'

export const Logout = () => {
  const { t } = useTranslation()
  const { data: currentUser } = useCurrentUser()
  const { keycloak } = useKeycloak()

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
            color="light"
            mx={1}
          >
            {currentUser?.firstName + ' ' + currentUser?.lastName}
          </BCTypography>
        )}
        <BCButton
          onClick={() => {
            logout()
          }}
          color="light"
          size="small"
          variant="outlined"
          data-test="logout-button"
        >
          {t('logout')}
        </BCButton>
      </BCBox>
    )
  )
}