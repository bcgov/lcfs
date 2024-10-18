import theme from '@/themes'
import { CssBaseline, ThemeProvider } from '@mui/material'
// import { ReactKeycloakProvider } from '@react-keycloak/web'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter as Router } from 'react-router-dom'

export const testQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      retry: false
    },
    mutations: {
      retry: false
    }
  }
})

export const wrapper = ({ children }) => (
  // <ReactKeycloakProvider authClient={keycloakMock}>
  <QueryClientProvider client={testQueryClient}>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>{children}</Router>
    </ThemeProvider>
  </QueryClientProvider>
  // </ReactKeycloakProvider>
)
