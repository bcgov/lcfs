import { Buffer } from 'buffer'
import { KeycloakProvider } from '@/components/KeycloakProvider'
import { AuthorizationProvider } from '@/contexts/AuthorizationContext'
import theme from '@/themes'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SnackbarProvider } from 'notistack'
import { createRoot } from 'react-dom/client'
import App from './App'
import './i18n'

// Polyfill Buffer for dependencies that require it (e.g., uuid)
if (!window.Buffer) window.Buffer = Buffer

const queryClient = new QueryClient()
const root = document.getElementById('root')

if (root) {
  createRoot(root).render(
    <main>
      <KeycloakProvider>
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
      </KeycloakProvider>
    </main>
  )
}
