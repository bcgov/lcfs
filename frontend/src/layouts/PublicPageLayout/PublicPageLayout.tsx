import { Outlet, useMatches } from 'react-router-dom'
import { Container, Stack } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import BCBox from '@/components/BCBox'
import Footer from '@/components/Footer'
import { PublicHeader } from './components/PublicHeader'
import { PublicBreadcrumb } from './components/PublicBreadcrumb'
import ROUTES from '@/routes/routes'
import { FEATURE_FLAGS, isFeatureEnabled } from '@/constants/config'

type RouteHandle = {
  title?: string
  hideBreadcrumb?: boolean
}

export const PublicPageLayout = () => {
  const matches = useMatches()
  const lastMatchHandle = matches[matches.length - 1]?.handle as
    | RouteHandle
    | undefined
  const pageTitle = lastMatchHandle?.title || 'LCFS'
  const hideBreadcrumb = lastMatchHandle?.hideBreadcrumb ?? false

  return (
    <BCBox display="flex" flexDirection="column" minHeight="100vh">
      <BCTypography variant="h1" className="visually-hidden">
        {pageTitle}
      </BCTypography>

      <PublicHeader />

      <Container
        maxWidth="lg"
        sx={{
          marginTop: hideBreadcrumb ? 0 : '1px',
          paddingX: '40px',
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          '@media (max-width: 920px)': {
            marginTop: hideBreadcrumb ? 0 : '2rem'
          }
        }}
        disableGutters
      >
        <Stack spacing={2} sx={{ flexGrow: 1 }}>
          {!hideBreadcrumb && (
            <BCBox size={12}>
              {isFeatureEnabled(FEATURE_FLAGS.CREDIT_MARKET_LOGIN_PAGE) ? (
                <PublicBreadcrumb
                  rootLabel="Home"
                  rootPath={ROUTES.PUBLIC_DASHBOARD}
                />
              ) : (
                <PublicBreadcrumb
                  rootLabel="Login"
                  rootPath={ROUTES.AUTH.LOGIN}
                />
              )}
            </BCBox>
          )}
          <BCBox
            elevation={5}
            sx={{
              padding: hideBreadcrumb ? 0 : '.75rem 0 0',
              minHeight: 'auto',
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Outlet />
          </BCBox>
        </Stack>
      </Container>

      <Footer />
    </BCBox>
  )
}
