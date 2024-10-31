import Loading from '@/components/Loading'
import theme from '@/themes'
import { getKeycloak, keycloakInitOptions } from '@/utils/keycloak'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { ReactKeycloakProvider } from '@react-keycloak/web'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import App from './App'
import './i18n'
import { ApiServiceProvider } from './services/apiClient/ApiServiceProvider'

const queryClient = new QueryClient()
const keycloak = getKeycloak()
const root = document.getElementById('root')

if (root) {
  createRoot(root).render(
    <main>
      <ReactKeycloakProvider
        authClient={keycloak}
        initOptions={keycloakInitOptions}
        LoadingComponent={<Loading />}
      >
        <ApiServiceProvider>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={theme}>
              <CssBaseline />
              <App />
            </ThemeProvider>
          </QueryClientProvider>
        </ApiServiceProvider>
      </ReactKeycloakProvider>
    </main>
  )
}
