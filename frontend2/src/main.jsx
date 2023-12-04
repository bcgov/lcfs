// import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ReactKeycloakProvider } from '@react-keycloak/web'
import { QueryClient, QueryClientProvider } from 'react-query'
import { getKeycloak, keycloakInitOptions } from '@/keycloak'
import { ThemeProvider } from '@mui/material'
import CssBaseline from '@mui/material/CssBaseline'
import Loading from '@/components/Loading'
import theme from '@/assets/theme'

const queryClient = new QueryClient()
const keycloak = getKeycloak()

ReactDOM.createRoot(document.getElementById('root')).render(
  // <React.StrictMode>
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
  // </React.StrictMode>
)
