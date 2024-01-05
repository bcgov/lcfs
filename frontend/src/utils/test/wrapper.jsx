import theme from '@/themes'
import { CssBaseline, ThemeProvider } from '@mui/material'
// import { ReactKeycloakProvider } from '@react-keycloak/web'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter as Router } from 'react-router-dom'

const testQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false
    }
  },
  logger: {
    log: console.log,
    warn: console.warn,
    error: () => {}
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
