import { CssBaseline, ThemeProvider } from '@mui/material'
import { createRoot } from 'react-dom/client'
import App from './App'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import theme from '@/themes'
import './i18n'
import { KeycloakProvider } from '@/components/KeycloakProvider'
import { getKeycloak } from '@/utils/keycloak'
import { LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3'
import { SnackbarProvider } from 'notistack'
import { AuthProvider } from '@/contexts/AuthContext'

const queryClient = new QueryClient()
const keycloak = getKeycloak()
const root = document.getElementById('root')

if (root) {
  createRoot(root).render(
    <main>
      <KeycloakProvider authClient={keycloak}>
        <AuthProvider>
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
        </AuthProvider>
      </KeycloakProvider>
    </main>
  )
}
