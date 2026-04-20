import bgFallbackImage from '@/assets/images/backgrounds/summer.webp'
import logoDark from '@/assets/images/logo-banner.svg'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { CONFIG } from '@/constants/config'
import { apiRoutes } from '@/constants/routes'
import { IDENTITY_PROVIDERS } from '@/constants/auth'
import { Alert, Card, Typography } from '@mui/material'
import Grid from '@mui/material/Grid'
import { useKeycloak } from '@react-keycloak/web'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { ROUTES } from '@/routes/routes'

export const Login = () => {
  const { t } = useTranslation()
  const { keycloak } = useKeycloak()
  const location = useLocation()
  const navigate = useNavigate()
  const redirectUri = window.location.origin
  const { message, severity } = location.state || {}

  const [bgUrl, setBgUrl] = useState(bgFallbackImage)
  const [credits, setCredits] = useState(null)

  useEffect(() => {
    const activeUrl = `${CONFIG.API_BASE}${apiRoutes.loginBgImageActive}`
    fetch(activeUrl)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.loginBgImageId) {
          const streamUrl = `${CONFIG.API_BASE}${apiRoutes.loginBgImageStream.replace(':imageId', data.loginBgImageId)}`
          setBgUrl(streamUrl)
          const creditParts = [data.displayName, data.caption].filter(Boolean)
          setCredits(creditParts.length ? creditParts.join(' — ') : null)
        }
      })
      .catch(() => {
        // keep fallback
      })
  }, [])

  const styles = useMemo(
    () => ({
      loginBackground: {
        backgroundImage: `url(${bgUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      },
      loginCard: {
        background: 'rgba(255, 255, 255, 0.15)',
        backdropFilter: 'blur(2px)',
        bordeRadius: '15px',
        border: '1px solid rgba(43, 43, 43, 0.568)'
      }
    }),
    [bgUrl]
  )

  return (
    <BCBox
      position="absolute"
      width="100%"
      minHeight="100vh"
      sx={styles.loginBackground}
      data-test="login"
    >
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
                {message && <Alert severity={severity}>{message}</Alert>}
                <BCBox component="form" role="form" data-test="login-container">
                  <BCBox mt={5} mb={1}>
                    <BCButton
                      variant="contained"
                      color="primary"
                      aria-label="Login with BCeID"
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
                        color="inherit"
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
                      variant="outlined"
                      color="white"
                      aria-label="Login with IDIR"
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
                        color="inherit"
                        sx={{ fontWeight: '400' }}
                      >
                        {t('login.loginMessage')}&nbsp;
                      </BCTypography>
                      <BCTypography variant="h6" mr={3} className="idir-name">
                        IDIR
                      </BCTypography>
                    </BCButton>
                  </BCBox>
                  <BCBox mt={4} mb={1}>
                    <BCButton
                      variant="contained"
                      color="glacier"
                      aria-label={t('login.publicCreditCalculator')}
                      onClick={() => navigate(ROUTES.PUBLIC_DASHBOARD)}
                      id="link-public-dashboard"
                      className="button"
                      data-test="link-public-dashboard"
                      size="large"
                      fullWidth
                    >
                      <BCTypography
                        variant="h6"
                        color="inherit"
                        sx={{
                          fontWeight: '400'
                        }}
                      >
                        {t('login.publicCreditCalculator')}
                      </BCTypography>
                    </BCButton>
                  </BCBox>
                </BCBox>
              </BCBox>
            </Card>
          </Grid>
        </Grid>
      </BCBox>

      {/* Photo credits overlay */}
      {credits && (
        <BCBox
          position="absolute"
          bottom={16}
          right={16}
          sx={{
            background: 'rgba(0,0,0,0.45)',
            borderRadius: 1,
            px: 2.5,
            py: 1,
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <Typography variant="caption" color="white" lineHeight={1}>
            {credits}
          </Typography>
        </BCBox>
      )}
    </BCBox>
  )
}
