import React, { useEffect } from 'react'
import { Outlet, useLocation, useMatches, useNavigate } from 'react-router-dom'
import { ROUTES } from '@/routes/routes'
import { Container, Stack } from '@mui/material'
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
import { useAuthorization } from '@/contexts/AuthorizationContext'
import { useAuth } from '@/hooks/useAuth'

export const MainLayout = () => {
  const { refreshToken } = useAuth()
  const loading = useLoadingStore((state) => state.loading)
  const navigate = useNavigate()
  const { forbidden } = useAuthorization()
  const { t } = useTranslation()
  const { data: currentUser } = useCurrentUser()
  const isGovernmentRole =
    currentUser?.roles?.some(({ name }) => name === t('gov')) ?? false
  const matches = useMatches()
  const pageTitle = matches[matches.length - 1]?.handle?.title || 'LCFS'
  const location = useLocation()

  useEffect(() => {
    // If "forbidden" is set, go to unauthorized page (unless we're already there)
    if (forbidden && window.location.pathname !== ROUTES.AUTH.UNAUTHORIZED) {
      navigate(ROUTES.AUTH.UNAUTHORIZED)
    }
  }, [forbidden, navigate])

  useEffect(() => {
    refreshToken(true)
  }, [location.pathname])

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
          <Stack container spacing={2}>
            <BCBox mt={-2} size={12}>
              <Crumb />
            </BCBox>
            <BCBox
              elevation={5}
              sx={{
                padding: '1rem 0rem',
                minHeight: 'auto'
              }}
            >
              <Outlet />
            </BCBox>
            <BCBox px={2} size={12}>
              <DisclaimerBanner
                messages={[
                  t('layout.disclaimer.part1'),
                  !isGovernmentRole ? t('layout.disclaimer.part2') : undefined
                ]}
              />
            </BCBox>
          </Stack>
        </Container>
        <Footer />
      </BCBox>
      {loading && <Loading fixed />}
    </RequireAuth>
  )
}
