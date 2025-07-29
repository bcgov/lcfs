// Particle Images
import autumn1 from '@/assets/images/particles/autumn-fall-leaves.png'
import autumn2 from '@/assets/images/particles/autumn-fall-leaves2.png'
import cherry1 from '@/assets/images/particles/cherry-blossom.png'
import cherry2 from '@/assets/images/particles/cherry-blossom2.png'
import snowflake1 from '@/assets/images/particles/snowflake.png'
import snowflake2 from '@/assets/images/particles/snowflake2.png'
import waterdrop from '@/assets/images/particles/water-drop.png'

// Background Images
import bgAutumnImage from '@/assets/images/backgrounds/autumn.webp'
import bgSpringImage from '@/assets/images/backgrounds/spring.webp'
import bgSummerImage from '@/assets/images/backgrounds/summer.webp'
import bgWinterImage from '@/assets/images/backgrounds/winter.webp'

import logoDark from '@/assets/images/logo-banner.svg'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { IDENTITY_PROVIDERS } from '@/constants/auth'
import { Alert, Card } from '@mui/material'
import Grid from '@mui/material/Grid'
import { useKeycloak } from '@react-keycloak/web'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { ROUTES } from '@/routes/routes'
import Snowfall from 'react-snowfall'

const currentDate = new Date()

const month = currentDate.getMonth() + 1 // Months are zero-indexed
const day = currentDate.getDate()

const season =
  (month === 3 && day >= 20) ||
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

const seasonImages = {
  spring: {
    count: 250,
    radius: [1, 4],
    wind: [2, 1],
    image: bgSpringImage
  },
  summer: {
    count: 150,
    radius: [2, 6],
    wind: [1, 1],
    image: bgSummerImage
  },
  autumn: {
    count: 5,
    radius: [12, 24],
    wind: [-0.5, 2.0],
    image: bgAutumnImage
  },
  winter: {
    count: 150,
    radius: [2, 6],
    wind: [-0.5, 2.0],
    image: bgWinterImage
  }
}

const droplets = () => {
  const elm1 = document.createElement('img')
  const elm2 = document.createElement('img')

  switch (season) {
    case 'spring':
      elm1.src = waterdrop
      elm2.src = waterdrop
      break
    case 'summer':
      elm1.src = cherry1
      elm2.src = cherry2
      break
    case 'autumn':
      elm1.src = autumn1
      elm2.src = autumn2
      break
    case 'winter':
      elm1.src = snowflake1
      elm2.src = snowflake2
      break
    default:
      break
  }
  return [elm1, elm2]
}

const image = seasonImages[season].image

export const Login = () => {
  const { t } = useTranslation()
  const { keycloak } = useKeycloak()
  const location = useLocation()
  const navigate = useNavigate()
  const redirectUri = window.location.origin
  const { message, severity } = location.state || {}
  const styles = useMemo(() => ({
    loginBackground: {
      backgroundImage: `url(${image})`,
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
  }))

  return (
    <BCBox
      position="absolute"
      width="100%"
      minHeight="100vh"
      sx={styles.loginBackground}
      data-test="login"
    >
      {season !== 'summer' && (
        <Snowfall
          wind={seasonImages[season].wind}
          snowflakeCount={seasonImages[season].count}
          radius={seasonImages[season].radius}
          images={droplets()}
        />
      )}
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
                      onClick={() => navigate(ROUTES.CREDIT_CALCULATOR)}
                      id="link-public-credit-calculator"
                      className="button"
                      data-test="link-public-credit-calculator"
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
    </BCBox>
  )
}
