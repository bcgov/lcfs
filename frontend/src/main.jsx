import { CssBaseline, ThemeProvider } from '@mui/material'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ReactKeycloakProvider } from '@react-keycloak/web'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { getKeycloak, keycloakInitOptions } from '@/utils/keycloak'
import Loading from '@/components/Loading'
import theme from '@/themes'

const queryClient = new QueryClient()
const keycloak = getKeycloak()
const root = document.getElementById('root')

if (root) {
  createRoot(root).render(
    <ReactKeycloakProvider
      authClient={keycloak}
      initOptions={keycloakInitOptions}
      LoadingComponent={<Loading />}
    >
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <App />
        </ThemeProvider>
      </QueryClientProvider>
    </ReactKeycloakProvider>
  )
}
