import BCBox from '@/components/BCBox'
import Footer from '@/components/Footer'
import AppNavbar from '@/components/Navbars/AppNavbar'
import { NavigateNext as NavigateNextIcon } from '@mui/icons-material'
import { Breadcrumbs, Grid, Link, Paper } from '@mui/material'
import { Outlet, Link as RouterLink, useMatches } from 'react-router-dom'
import RequireAuth from '@/components/RequireAuth'
import * as appRoutes from '@/constants/routes'

const Layout = ({ crumbs }) => {
  const matches = useMatches()
  const breadcrumbs = matches
    .filter((match) => Boolean(match.handle?.crumb))
    .map((match) => ({
      label: match.handle.crumb(match.data),
      path: match.pathname
    }))

  return (
    <RequireAuth redirectTo={appRoutes.LOGIN}>
      <Grid
        container
        rowSpacing={2}
        sx={{
          margin: '0',
          padding: '1rem',
          background: 'background.paper'
        }}
        columnSpacing={{ xs: 1, sm: 1, md: 1 }}
      >
        <Grid
          item
          xs={12}
          sx={{
            maxHeight: '20vh',
            position: 'relative',
            top: 0,
            zIndex: 10 // Adjust the z-index if needed
          }}
        >
          <AppNavbar
            title="Low Carbon Fuel Standard"
            balance="50,000"
            organizationName="BC Government"
          />
        </Grid>
        <Grid item my={12} lg={12}>
          <BCBox>
            {crumbs && (
              <Paper
                p={2}
                elevation={5}
                sx={{ padding: '1rem', minHeight: '5vh' }}
              >
                <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />}>
                  {breadcrumbs.map((crumb, index) =>
                    index + 1 !== breadcrumbs.length ? (
                      <Link
                        key={crumb.path}
                        component={RouterLink}
                        to={crumb.path}
                        disabled={true}
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span key={crumb.path}>{crumb.label}</span>
                    )
                  )}
                </Breadcrumbs>
              </Paper>
            )}
            <BCBox py={4}>
              <Outlet />
              <Footer />
            </BCBox>
          </BCBox>
        </Grid>
      </Grid>
    </RequireAuth>
  )
}
export default Layout
