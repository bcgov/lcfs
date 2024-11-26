import { CssBaseline, ThemeProvider } from '@mui/material'
import { createRoot } from 'react-dom/client'
import App from './App'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import theme from '@/themes'
import './i18n'
import { KeycloakProvider } from '@/components/KeycloakProvider'
import { getKeycloak } from '@/utils/keycloak'

const queryClient = new QueryClient()
const keycloak = getKeycloak()
const root = document.getElementById('root')

if (root) {
  createRoot(root).render(
    <main>
      <KeycloakProvider authClient={keycloak}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <App />
          </ThemeProvider>
        </QueryClientProvider>
      </KeycloakProvider>
    </main>
  )
}
