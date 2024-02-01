import logoDark from '@/assets/images/logo-banner.svg'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { IDENTITY_PROVIDERS } from '@/constants/auth'
import { Card, Grid, Alert } from '@mui/material'
import { useKeycloak } from '@react-keycloak/web'
import { Link, useLocation } from 'react-router-dom'
import Snowfall from 'react-snowfall'
import { logout } from '@/utils/keycloak'
import { Logout } from '@/layouts/MainLayout/components/Logout'
import { bgImage } from './index'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export const Login = () => {
  const { t } = useTranslation()
  const { keycloak } = useKeycloak()
  const location = useLocation()
  const redirectUri = window.location.origin
  const { message, severity } = location.state || {}

  const styles = useMemo(() => ({
    loginBackground: {
      backgroundImage: `url(${bgImage.image})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    },
    loginCard: {
      background: 'rgba(255, 255, 255, 0.15)',
      backdropFilter: 'blur(8px)',
      bordeRadius: '15px',
      border: '1px solid rgba(43, 43, 43, 0.568)'
    }
  }))
  return (
    <BCBox
      position="absolute"
      width="100%"
      minHeight="100vh"
      sx={styles.loginBackground}
    >
      <Snowfall
        wind={bgImage.wind}
        snowflakeCount={bgImage.count}
        radius={bgImage.radius}
        images={bgImage.droplets}
      />
      <BCTypography variant="h1" className="visually-hidden">
        Login
      </BCTypography>
      <BCBox px={1} width="100%" height="100vh" mx="auto">
        <Grid
          container
          spacing={1}
          justifyContent="center"
          alignItems="center"
          height="100%"
        >
          <Grid item xs={11} sm={9} md={5} lg={4} xl={3} hd={3} u4k={2}>
            <Card className="login" sx={styles.loginCard}>
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
                  style={{
                    width: '160px',
                    marginRight: '10px',
                    height: 'auto'
                  }}
                />
                <BCTypography
                  variant="h5"
                  fontWeight="medium"
                  color="white"
                  mt={1}
                >
                  {t('title')}
                </BCTypography>
              </BCBox>
              <BCBox pt={1} pb={3} px={3}>
                {message && (
                  <Alert severity={severity}>
                    {message}
                    <Logout />
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
                        {t('login.loginMessage')}&nbsp;
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
                        {t('login.loginMessage')}&nbsp;
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
                        data-test="login-help-link"
                        component="button"
                        variant="button"
                        to="/contact-us"
                        fontWeight="medium"
                      >
                        <BCTypography variant="body2" color="light">
                          {t('login.troubleMessage')}
                        </BCTypography>
                      </Link>
                    </BCButton>
                    <BCButton
                      onClick={() => {
                        logout()
                      }}
                      data-test="logout-button"
                      style={{ display: 'none' }}
                    >
                      Log out
                    </BCButton>
                  </BCBox>
                </BCBox>
              </BCBox>
            </Card>
          </Grid>
        </Grid>
      </BCBox>
    </BCBox>
  )
}
