import { Outlet, useMatches } from 'react-router-dom'
// constants
import { ROUTES } from '@/constants/routes'
// @mui components
import { Container } from '@mui/material'
import Grid from '@mui/material/Unstable_Grid2'
// @mui custom components
import BCTypography from '@/components/BCTypography'
import Footer from '@/components/Footer'
import RequireAuth from '@/components/RequireAuth'
import { Navbar } from './components/Navbar'
import DisclaimerBanner from '@/components/DisclaimerBanner'
import Crumb from '@/layouts/MainLayout/components/Crumb'
// hooks
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useTranslation } from 'react-i18next'
// icons and typograhpy
import BCBox from '@/components/BCBox'

export const MainLayout = () => {
  const { t } = useTranslation()
  const { data: currentUser } = useCurrentUser()
  const isGovernmentRole =
    currentUser?.roles?.some(({ name }) => name === t('gov')) ?? false

  const matches = useMatches()
  const pageTitle = matches[matches.length - 1]?.handle?.title || 'LCFS'

  return (
    <RequireAuth redirectTo={ROUTES.LOGIN}>
      <BCTypography variant="h1" className="visually-hidden">
        {pageTitle}
      </BCTypography>
      <Navbar />
      <Container
        maxWidth="lg"
        sx={({ palette: { background } }) => ({
          padding: '1rem',
          minHeight: 'calc(100vh - 4.89rem)',
          background: background.paper,
          '@media (max-width: 920px)': {
            marginTop: '-2rem'
          }
        })}
        disableGutters={true}
      >
        <Grid xs={12} mt={12}>
          <Crumb />
        </Grid>
        <Grid lg={12}>
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
        <Grid lg={12}>
          <DisclaimerBanner
            messages={[
              t('layout.disclaimer.part1'),
              !isGovernmentRole ? t('layout.disclaimer.part2') : undefined
            ]}
          />
        </Grid>
      </Container>
      <Footer />
    </RequireAuth>
  )
}
