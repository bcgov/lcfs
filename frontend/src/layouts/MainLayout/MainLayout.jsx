import { Outlet, Link as RouterLink, useMatches } from 'react-router-dom'
// constants
import { ROUTES } from '@/constants/routes'
// @mui components
import { Breadcrumbs, Container } from '@mui/material'
import Grid from '@mui/material/Unstable_Grid2'
// @mui custom components
import BCTypography from '@/components/BCTypography'
import Footer from '@/components/Footer'
import RequireAuth from '@/components/RequireAuth'
import { Navbar } from './components/Navbar'
import DisclaimerBanner from '@/components/DisclaimerBanner'
// hooks
import { useCurrentUser } from '@/hooks/useCurrentUser'
// icons and typograhpy
import typography from '@/themes/base/typography'
import { NavigateNext as NavigateNextIcon } from '@mui/icons-material'
import BCBox from '@/components/BCBox'
import { useTranslation } from 'react-i18next'

export const MainLayout = () => {
  const { t } = useTranslation()
  const { data: currentUser } = useCurrentUser()
  const isGovernmentRole =
    currentUser?.roles?.some(({ name }) => name === 'Government') ?? false

  const matches = useMatches()
  const { size } = typography
  const breadcrumbs = matches
    .filter((match) => Boolean(match.handle?.crumb))
    .map((match) => ({
      label: match.handle.crumb(match.data),
      path: match.pathname
    }))
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
          {breadcrumbs.length > 0 && (
            <Breadcrumbs
              m={2}
              separator={
                <NavigateNextIcon fontSize="small" aria-label="breadcrumb" />
              }
            >
              <BCTypography
                component={RouterLink}
                to={ROUTES.DASHBOARD}
                variant="button"
                fontSize={size.lg}
              >
                {t('layout.breadCrumbHome')}
              </BCTypography>
              {breadcrumbs.map((crumb, index) =>
                index + 1 !== breadcrumbs.length ? (
                  <BCTypography
                    key={crumb.path}
                    component={RouterLink}
                    to={crumb.path}
                    // disabled={true}
                    variant="button"
                    fontSize={size.lg}
                  >
                    {crumb.label}
                  </BCTypography>
                ) : (
                  <BCTypography
                    variant="button"
                    key={crumb.path}
                    color="text"
                    fontSize={size.lg}
                  >
                    {crumb.label}
                  </BCTypography>
                )
              )}
            </Breadcrumbs>
          )}
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
