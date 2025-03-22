import React, { useEffect } from 'react'
import { Outlet, useMatches, useNavigate } from 'react-router-dom'
import { ROUTES } from '@/routes/routes'
import { Container } from '@mui/material'
import Grid from '@mui/material/Unstable_Grid2'
import BCTypography from '@/components/BCTypography'
import Footer from '@/components/Footer'
import { RequireAuth } from '@/components/RequireAuth'
import { Navbar } from './components/Navbar'
import DisclaimerBanner from '@/components/DisclaimerBanner'
import Crumb from '@/layouts/MainLayout/components/Crumb'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useTranslation } from 'react-i18next'
import BCBox from '@/components/BCBox'
import { useLoadingStore } from '@/stores/useLoadingStore'
import Loading from '@/components/Loading'
import { useAuth } from '@/contexts/AuthContext'

export const MainLayout = () => {
  const loading = useLoadingStore((state) => state.loading)
  const navigate = useNavigate()
  const { forbidden } = useAuth()
  const { t } = useTranslation()
  const { data: currentUser } = useCurrentUser()
  const isGovernmentRole =
    currentUser?.roles?.some(({ name }) => name === t('gov')) ?? false
  const matches = useMatches()
  const pageTitle = matches[matches.length - 1]?.handle?.title || 'LCFS'

  useEffect(() => {
    // If "forbidden" is set, go to unauthorized page (unless we're already there)
    if (forbidden && window.location.pathname !== ROUTES.AUTH.UNAUTHORIZED) {
      navigate(ROUTES.AUTH.UNAUTHORIZED)
    }
  }, [forbidden, navigate])

  return (
    <RequireAuth redirectTo={ROUTES.AUTH.LOGIN}>
      <BCBox display="flex" flexDirection="column" minHeight="100vh">
        <BCTypography variant="h1" className="visually-hidden">
          {pageTitle}
        </BCTypography>
        <Navbar />
        <Container
          maxWidth="lg"
          sx={{
            padding: '1rem',
            flexGrow: 1,
            '@media (max-width: 920px)': {
              marginTop: '2rem'
            }
          }}
          disableGutters
        >
          <Grid container spacing={2}>
            <Grid item="true" xs={12} mt={-2}>
              <Crumb />
            </Grid>
            <Grid item="true" xs={12}>
              <BCBox
                elevation={5}
                sx={{
                  padding: '1rem 0rem',
                  minHeight: 'auto'
                }}
              >
                <Outlet />
              </BCBox>
            </Grid>
            <Grid item="true" xs={12} px={2}>
              <DisclaimerBanner
                messages={[
                  t('layout.disclaimer.part1'),
                  !isGovernmentRole ? t('layout.disclaimer.part2') : undefined
                ]}
              />
            </Grid>
          </Grid>
        </Container>
        <Footer />
      </BCBox>
      {loading && <Loading fixed />}
    </RequireAuth>
  )
}
