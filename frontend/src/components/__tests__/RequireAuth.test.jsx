import { RequireAuth } from '@/components/RequireAuth'
import { apiRoutes } from '@/constants/routes'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { render, renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, delay } from 'msw'
import { httpOverwrite } from '@/tests/utils/handlers'
import { wrapper } from '@/tests/utils/wrapper'

const keycloak = vi.hoisted(() => ({
  useKeycloak: vi.fn()
}))
vi.mock('@react-keycloak/web', () => keycloak)

describe('RequireAuth', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })
  describe('loading', () => {
    it('should render loading when isLoading is true', async () => {
      keycloak.useKeycloak.mockReturnValue({
        keycloak: { authenticated: true },
        initialized: true
      })
      httpOverwrite(
        'get',
        apiRoutes.currentUser,
        async () => await delay('infinite')
      )

      const { getByTestId } = render(<RequireAuth />, { wrapper })

      expect(getByTestId('loading')).toBeInTheDocument()
    })
    it('should render loading when initialized is false', async () => {
      keycloak.useKeycloak.mockReturnValue({
        keycloak: { authenticated: true },
        initialized: false
      })

      const { getByTestId } = render(<RequireAuth />, { wrapper })
      expect(getByTestId('loading')).toBeInTheDocument()
    })
  })
  describe('network error', async () => {
    it('should navigate ( null return )', async () => {
      keycloak.useKeycloak.mockReturnValue({
        keycloak: { authenticated: true },
        initialized: true
      })
      httpOverwrite('get', apiRoutes.currentUser, async () =>
        HttpResponse.error()
      )

      const { result } = renderHook(useCurrentUser, { wrapper })

      const { container } = render(<RequireAuth />, {
        wrapper
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(container.firstChild).toBeNull()
    })
  })
  describe('keycloak not authenticated', () => {
    it('should navigate ( null return )', () => {
      keycloak.useKeycloak.mockReturnValue({
        keycloak: { authenticated: false },
        initialized: true
      })

      const { container } = render(<RequireAuth />, {
        wrapper
      })

      expect(container.firstChild).toBeNull()
    })
  })
  describe('ok', () => {
    it('renders children', async () => {
      keycloak.useKeycloak.mockReturnValue({
        keycloak: { authenticated: true },
        initialized: true
      })
      const { result } = renderHook(useCurrentUser, { wrapper })
      const { getByText } = render(<RequireAuth>asdf</RequireAuth>, {
        wrapper
      })
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(getByText('asdf')).toBeInTheDocument()
    })
  })
})
