import { Logout } from '@/components/Logout'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import * as keycloakUtils from '@/utils/keycloak'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, vi } from 'vitest'
import { test } from '@/tests/utils/fixtures'

vi.mock('@/contexts/AuthorizationContext', () => ({
  useAuthorization: () => ({
    setForbidden: vi.fn(),
    addErrorRef: vi.fn(),
    setErrorStatus: vi.fn(),
    serverErrorBlockedRef: { current: false }
  })
}))

const keycloak = vi.hoisted(() => ({
  useKeycloak: vi.fn()
}))
vi.mock('@react-keycloak/web', () => keycloak)

describe('Logout.jsx', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('is not authenticated', () => {
    test('returns null', ({ render, query, theme }) => {
      keycloak.useKeycloak.mockReturnValue({
        keycloak: { authenticated: false }
      })

      const { container } = render(<Logout />, [query, theme])

      expect(container.firstChild).toBeNull()
    })
  })

  describe('is authenticated', () => {
    test.beforeEach(async ({ render, renderHook, query, theme, server }) => {
      void server
      keycloak.useKeycloak.mockReturnValue({
        keycloak: { authenticated: true }
      })
      const { result } = renderHook(() => useCurrentUser(), [query])
      await waitFor(() => expect(result.current.isSuccess).toBeTruthy())

      render(<Logout />, [query, theme])
    })
    test('should render Logout', async () => {
      const logout = await screen.findByTestId('logout')

      expect(logout).toBeInTheDocument()
    })
    test('should fire the logout function once', async () => {
      const logoutFn = vi
        .spyOn(keycloakUtils, 'logout')
        .mockImplementation(() => {})

      const button = await screen.findByTestId('logout-button')

      fireEvent.click(button)

      expect(logoutFn).toHaveBeenCalled()
    })
  })
})
