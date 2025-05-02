import { Logout } from '@/components/Logout'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { wrapper } from '@/tests/utils/wrapper'
import * as keycloakUtils from '@/utils/keycloak'
import {
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor
} from '@testing-library/react'
import { describe, vi } from 'vitest'

vi.mock('@/contexts/AuthorizationContext', () => ({
  useAuthorization: () => ({
    setForbidden: vi.fn()
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
    it('returns null', () => {
      keycloak.useKeycloak.mockReturnValue({
        keycloak: { authenticated: false }
      })

      const { container } = render(<Logout />, { wrapper })

      expect(container.firstChild).toBeNull()
    })
  })

  describe('is authenticated', () => {
    beforeEach(async () => {
      keycloak.useKeycloak.mockReturnValue({
        keycloak: { authenticated: true }
      })
      const { result } = renderHook(() => useCurrentUser(), {
        wrapper
      })
      await waitFor(() => expect(result.current.isSuccess).toBeTruthy())

      render(<Logout />, { wrapper })
    })
    it('should render Logout', async () => {
      const logout = await screen.findByTestId('logout')

      expect(logout).toBeInTheDocument()
    })
    it('should fire the logout function once', async () => {
      const logoutFn = vi
        .spyOn(keycloakUtils, 'logout')
        .mockImplementation(() => {})

      const button = await screen.findByTestId('logout-button')

      fireEvent.click(button)

      expect(logoutFn).toHaveBeenCalled()
    })
  })
})
