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
        alignItems="center"
        justifyContent="space-between"
        mr={3}
      >
        {currentUser?.firstName && (
          <BCTypography
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              flexShrink: 1,
              marginRight: '12px',
              maxWidth: '17vw'
            }}
            variant="subtitle1"
            color="light"
          >
            {currentUser?.firstName + ' ' + currentUser?.lastName}
          </BCTypography>
        )}
        <BCButton
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
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
