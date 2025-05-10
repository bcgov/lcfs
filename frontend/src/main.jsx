import { AuthorizationProvider } from '@/contexts/AuthorizationContext'
import theme from '@/themes'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from 'react-oidc-context'
import { SnackbarProvider } from 'notistack'
import { createRoot } from 'react-dom/client'
import App from './App'
import './i18n'
import { CONFIG } from '@/constants/config'

const oidcConfig = {
  authority: `${CONFIG.KEYCLOAK.AUTH_URL}/realms/${CONFIG.KEYCLOAK.REALM}`,
  client_id: CONFIG.KEYCLOAK.CLIENT_ID,
  redirect_uri: window.location.origin + '/oidc-callback',
  post_logout_redirect_uri: CONFIG.KEYCLOAK.POST_LOGOUT_URL,
  scope: 'openid profile email offline_access',
  automaticSilentRenew: true,
  silent_redirect_uri: window.location.origin + '/silent-renew.html'
}

const queryClient = new QueryClient()
const root = document.getElementById('root')

if (root) {
  createRoot(root).render(
    <main>
      <AuthProvider {...oidcConfig}>
        <AuthorizationProvider>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={theme}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <SnackbarProvider>
                  <CssBaseline />
                  <App />
                </SnackbarProvider>
              </LocalizationProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </AuthorizationProvider>
      </AuthProvider>
    </main>
  )
}
