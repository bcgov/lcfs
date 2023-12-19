import { render, screen } from '@testing-library/react'
import Dashboard from './Dashboard'
import { QueryClient, QueryClientProvider } from 'react-query'
import { ReactKeycloakProvider } from '@react-keycloak/web'
import { test, expect, vi } from 'vitest'

const queryClient = new QueryClient()
const keycloakMock = {
  init: vi.fn().mockResolvedValue(true)
}

// Wrapper component for tests
const wrapper = ({ children }) => (
  <ReactKeycloakProvider authClient={keycloakMock}>
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  </ReactKeycloakProvider>
)

test('renders Dashboard component', () => {
  render(<Dashboard />, { wrapper })
  const linkElement = screen.getByText(/Dashboard/i)
  expect(linkElement).toBeInTheDocument()
})
