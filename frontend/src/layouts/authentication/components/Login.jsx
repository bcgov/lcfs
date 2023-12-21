import { Link } from 'react-router-dom'
import { useKeycloak } from '@react-keycloak/web'
import { useLocation } from 'react-router-dom'

// Constants
import { IDENTITY_PROVIDERS } from '@/constants/auth'
// BC @mui components
import LoginLayout from '@/layouts/authentication/LoginLayout'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'

// @mui material components
import { Alert, Card } from '@mui/material'

// Images
import logoDark from '@/assets/images/gov3_bc_logo.png'

function getSeason(date) {
  const month = date.getMonth() + 1 // Months are zero-indexed
  const day = date.getDate()

  return (month === 3 && day >= 20) ||
    (month > 3 && month < 6) ||
    (month === 6 && day <= 20)
    ? 'spring'
    : (month === 6 && day >= 21) ||
        (month > 6 && month < 9) ||
        (month === 9 && day <= 21)
      ? 'summer'
      : (month === 9 && day >= 22) ||
          (month > 9 && month < 12) ||
          (month === 12 && day <= 20)
        ? 'autumn'
        : 'winter'
}

const Login = () => {
  const { keycloak } = useKeycloak()
  const redirectUri = window.location.origin
  const currentDate = new Date()
  const location = useLocation()

  const { message, severity } = location.state || {};

  return (
    <LoginLayout season={getSeason(currentDate)}>
      <Card
        className="login"
        sx={{
          background: 'rgba(255, 255, 255, 0.2)',
          backdropFilter: 'blur(10px)',
          bordeRadius: '15px',
          border: '1px solid rgba(43, 43, 43, 0.568)'
        }}
      >
        <BCBox
          variant="gradient"
          bgColor="primary"
          borderRadius="lg"
          coloredShadow="primary"
          mx={2}
          mt={-3}
          p={2}
          mb={1}
          textAlign="center"
        >
          <img
            src={logoDark}
            alt="BC Government Logo"
            style={{ width: '160px', marginRight: '10px', height: 'auto' }}
          />
          <BCTypography variant="h5" fontWeight="medium" color="white" mt={1}>
            Low Carbon Fuel Standard
          </BCTypography>
        </BCBox>
        <BCBox pt={1} pb={3} px={3}>
          {message && (
            <Alert severity={severity}>
              {message}
            </Alert>
          )}
          <BCBox component="form" role="form" data-test="login-container">
            <BCBox mt={4} mb={1}>
              <BCButton
                variant="contained"
                color="primary"
                onClick={() => {
                  keycloak.login({
                    idpHint: IDENTITY_PROVIDERS.BCEID_BUSINESS,
                    redirectUri
                  })
                }}
                id="link-bceid"
                className="button"
                data-test="link-bceid"
                size="large"
                fullWidth
              >
                <BCTypography
                  variant="h6"
                  component="span"
                  color="text"
                  sx={{ fontWeight: '400' }}
                >
                  Login with&nbsp;
                </BCTypography>
                <BCTypography
                  variant="h6"
                  component="span"
                  className="bceid-name"
                >
                  BCeID
                </BCTypography>
              </BCButton>
            </BCBox>
            <BCBox mt={4} mb={1}>
              <BCButton
                variant="contained"
                color="light"
                onClick={() => {
                  keycloak.login({
                    idpHint: IDENTITY_PROVIDERS.IDIR,
                    redirectUri
                  })
                }}
                id="link-idir"
                className="button"
                data-test="link-idir"
                size="large"
                fullWidth
              >
                <BCTypography
                  variant="h6"
                  color="text"
                  sx={{ fontWeight: '400' }}
                >
                  Login with&nbsp;
                </BCTypography>
                <BCTypography variant="h6" mr={3} className="idir-name">
                  IDIR
                </BCTypography>
              </BCButton>
            </BCBox>
            <BCBox mt={3} mb={1} textAlign="center">
              <BCButton variant="contained" color="dark" size="small">
                {' '}
                <Link
                  component="button"
                  variant="button"
                  to="/contact-us"
                  fontWeight="medium"
                >
                  <BCTypography variant="body2" color="light">
                    Trouble logging in?
                  </BCTypography>
                </Link>
              </BCButton>
            </BCBox>
          </BCBox>
        </BCBox>
      </Card>
    </LoginLayout>
  )
}

export default Login
