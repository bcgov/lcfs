import { CssBaseline, ThemeProvider } from '@mui/material'
import { createRoot } from 'react-dom/client'
import App from './App'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import theme from '@/themes'
import './i18n'
import { KeycloakProvider } from '@/components/KeycloakProvider'
import { getKeycloak } from '@/utils/keycloak'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { LocalizationProvider } from '@mui/x-date-pickers'

const queryClient = new QueryClient()
const keycloak = getKeycloak()
const root = document.getElementById('root')

if (root) {
  createRoot(root).render(
    <main>
      <KeycloakProvider authClient={keycloak}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider theme={theme}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <CssBaseline />
              <App />
            </LocalizationProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </KeycloakProvider>
    </main>
  )
}
