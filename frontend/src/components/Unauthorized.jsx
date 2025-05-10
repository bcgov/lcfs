import { Link } from '@mui/material'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import BCButton from '@/components/BCButton'
import { faRightToBracket } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useAuth } from '@/hooks/useAuth'
import { useTranslation } from 'react-i18next'

export const Unauthorized = () => {
  const { t } = useTranslation('common')
  const auth = useAuth()

  const handleLoginClick = async (e) => {
    e.preventDefault()

    sessionStorage.clear()
    localStorage.clear()

    if (auth.isAuthenticated) {
      await auth.signoutRedirect({
        post_logout_redirect_uri: window.location.href
      })
    } else {
      auth.signinRedirect()
    }
  }

  if (auth.isLoading) {
    return <div>Loading...</div>
  }

  return (
    <BCBox
      minHeight="100vh"
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      textAlign="center"
    >
      <BCTypography
        variant="h1"
        sx={{ fontWeight: 'bold', color: '#003366', mb: 2 }}
      >
        {t('unauthorized.title')}
      </BCTypography>

      <BCTypography
        variant="body2"
        sx={{ fontWeight: 'bold', maxWidth: 700, mb: 3 }}
      >
        {t('unauthorized.message')}
        <br />
        {t('unauthorized.contact')}{' '}
        <Link
          href={`mailto:${t('unauthorized.email')}`}
          underline="always"
          sx={{
            color: '#003366',
            fontWeight: 'bold'
          }}
        >
          {t('unauthorized.email')}
        </Link>
      </BCTypography>

      <BCButton
        variant="contained"
        color="primary"
        onClick={handleLoginClick}
        startIcon={
          <FontAwesomeIcon icon={faRightToBracket} className="small-icon" />
        }
        data-test="return-login-button"
      >
        {t('unauthorized.returnToLogin')}
      </BCButton>
    </BCBox>
  )
}
