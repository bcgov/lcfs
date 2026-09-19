import { RequireAuth } from '@/components/RequireAuth'
import { apiRoutes } from '@/constants/routes'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { waitFor } from '@testing-library/react'
import { test } from '@/tests/utils/fixtures'

const keycloak = vi.hoisted(() => ({
  useKeycloak: vi.fn()
}))
vi.mock('@react-keycloak/web', () => keycloak)

vi.mock('@/contexts/AuthorizationContext', () => ({
  useAuthorization: () => ({
    setForbidden: vi.fn(),
    addErrorRef: vi.fn(),
    setErrorStatus: vi.fn(),
    serverErrorBlockedRef: { current: false }
  })
}))

describe('RequireAuth', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })
  describe('network error', async () => {
    test('should navigate ( null return )', async ({
      render,
      renderHook,
      query,
      router,
      server
    }) => {
      keycloak.useKeycloak.mockReturnValue({
        keycloak: { authenticated: true },
        initialized: true
      })
      const { HttpResponse } = await import('msw')
      server.httpOverwrite('get', apiRoutes.currentUser, async () =>
        HttpResponse.error()
      )

      const providers = [query, router]
      const { result } = renderHook(useCurrentUser, providers)

      const { container } = render(<RequireAuth />, providers)

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(container.firstChild).toBeNull()
    })
  })
  describe('keycloak not authenticated', () => {
    test('should navigate ( null return )', ({ render, query, router }) => {
      keycloak.useKeycloak.mockReturnValue({
        keycloak: { authenticated: false },
        initialized: true
      })

      const { container } = render(<RequireAuth />, [query, router])

      expect(container.firstChild).toBeNull()
    })
  })
  describe('ok', () => {
    test('renders children', async ({
      render,
      renderHook,
      query,
      router,
      server
    }) => {
      void server
      keycloak.useKeycloak.mockReturnValue({
        keycloak: { authenticated: true },
        initialized: true
      })
      const providers = [query, router]
      const { result } = renderHook(useCurrentUser, providers)
      const { getByText } = render(<RequireAuth>asdf</RequireAuth>, providers)
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(getByText('asdf')).toBeInTheDocument()
    })
  })
})
