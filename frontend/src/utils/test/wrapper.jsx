import theme from '@/themes'
import { ThemeProvider } from '@mui/material'
import { ReactKeycloakProvider } from '@react-keycloak/web'
import { QueryClient, QueryClientProvider } from 'react-query'
import { vi } from 'vitest'

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

// need to mock keycloak user
const keycloakMock = {
  init: vi.fn().mockResolvedValue(true)
}

export const wrapper = ({ children }) => (
  <ReactKeycloakProvider authClient={keycloakMock}>
    <QueryClientProvider client={testQueryClient}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </QueryClientProvider>
  </ReactKeycloakProvider>
)
