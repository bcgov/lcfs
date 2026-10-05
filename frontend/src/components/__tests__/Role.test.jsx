import { Role } from '@/components/Role'
import { apiRoutes } from '@/constants/routes'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { screen, waitFor } from '@testing-library/react'
import { test } from '@/tests/utils/fixtures'

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: vi.fn().mockReturnValue({
    keycloak: { authenticated: true }
  })
}))

vi.mock('@/contexts/AuthorizationContext', () => ({
  useAuthorization: () => ({
    setForbidden: vi.fn(),
    addErrorRef: vi.fn(),
    setErrorStatus: vi.fn(),
    serverErrorBlockedRef: { current: false }
  })
}))

describe('Role.jsx', () => {
  describe('currentUser is null', () => {
    test('should render loading', ({
      render: renderWithProviders,
      query,
      server
    }) => {
      void server
      const { getByTestId } = renderWithProviders(<Role />, [query])

      expect(getByTestId('loading')).toBeInTheDocument()
    })
  })
  describe('currentUser is not null', () => {
    test.beforeEach(async ({ server, renderHook, query }) => {
      const { HttpResponse } = await import('msw')
      server.httpOverwrite('get', apiRoutes.currentUser, () =>
        HttpResponse.json({
          roles: [{ name: 'Government' }]
        })
      )
      const { result } = renderHook(useCurrentUser, [query])

      await waitFor(() => expect(result.current.isLoading).toBe(false))
    })
    describe('is not authorized', () => {
      test('should render null', async ({
        render: renderWithProviders,
        query
      }) => {
        const { container } = renderWithProviders(
          <Role roles={['Director']}>child</Role>,
          [query]
        )

        expect(container.firstChild).toBeNull()
      })
    })
    describe('is authorized', () => {
      test('should render Role', async ({
        render: renderWithProviders,
        query
      }) => {
        renderWithProviders(<Role roles={['Government']}>child</Role>, [query])
        expect(screen.getByText('child')).toBeInTheDocument()
      })
    })
  })
})
