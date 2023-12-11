import { Outlet, useMatches, Link as RouterLink } from 'react-router-dom'
// constants
import { appRoutes } from '@/constants/routes'
// @mui components
import { Paper, Breadcrumbs, Container } from '@mui/material'
import Grid from '@mui/material/Unstable_Grid2'
// @mui custom components
import Footer from '@/components/Footer'
import BCTypography from '@/components/BCTypography'
import Navbar from '@/layouts/navbar/Navbar'
import RequireAuth from '@/components/RequireAuth'
// icons and typograhpy
import { NavigateNext as NavigateNextIcon } from '@mui/icons-material'
import typography from '@/assets/theme/base/typography'

const Layout = ({ crumbs }) => {
  const matches = useMatches()
  const { size } = typography
  const breadcrumbs = matches
    .filter((match) => Boolean(match.handle?.crumb))
    .map((match) => ({
      label: match.handle.crumb(match.data),
      path: match.pathname
    }))

  return (
    <RequireAuth redirectTo={appRoutes.login.main}>
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
        <Grid item xs={12} mt={12}>
          {crumbs && (
            <Breadcrumbs
              m={2}
              separator={
                <NavigateNextIcon fontSize="small" aria-label="breadcrumb" />
              }
            >
              {breadcrumbs.map((crumb, index) =>
                index + 1 !== breadcrumbs.length ? (
                  <BCTypography
                    key={crumb.path}
                    component={RouterLink}
                    to={crumb.path}
                    disabled={true}
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
        <Grid item lg={12}>
          <Paper
            elevation={5}
            sx={{
              padding: '1rem',
              position: 'relative',
              minHeight: 'calc(100vh - 16rem)'
            }}
          >
            <Outlet />
          </Paper>
        </Grid>
      </Container>
      <Footer />
    </RequireAuth>
  )
}
export default Layout
