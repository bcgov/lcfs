import { Role } from '@/components/Role'
import { apiRoutes } from '@/constants/routes'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { wrapper } from '@/tests/utils/wrapper'
import { render, renderHook, screen, waitFor } from '@testing-library/react'
import { HttpResponse } from 'msw'
import { httpOverwrite } from '@/tests/utils/handlers'

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: vi.fn().mockReturnValue({
    keycloak: { authenticated: true }
  })
}))

vi.mock('@/contexts/AuthorizationContext', () => ({
  useAuthorization: () => ({
    setForbidden: vi.fn()
  })
}))

describe('Role.jsx', () => {
  describe('currentUser is null', () => {
    it('should render loading', () => {
      const { getByTestId } = render(<Role />, { wrapper })

      expect(getByTestId('loading')).toBeInTheDocument()
    })
  })
  describe('currentUser is not null', () => {
    beforeEach(async () => {
      httpOverwrite('get', apiRoutes.currentUser, () =>
        HttpResponse.json({
          roles: [{ name: 'Government' }]
        })
      )
      const { result } = renderHook(useCurrentUser, { wrapper })

      await waitFor(() => expect(result.current.isLoading).toBe(false))
    })
    describe('is not authorized', () => {
      it('should render null', async () => {
        const { container } = render(<Role roles={['Director']}>child</Role>, {
          wrapper
        })

        expect(container.firstChild).toBeNull()
      })
    })
    describe('is authorized', () => {
      it('should render Role', async () => {
        render(<Role roles={['Government']}>child</Role>, { wrapper })
        expect(screen.getByText('child')).toBeInTheDocument()
      })
    })
  })
})
