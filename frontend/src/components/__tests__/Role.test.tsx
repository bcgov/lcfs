import { Role } from '@/components/Role'
import { screen } from '@testing-library/react'
import { test } from '@/tests/utils/fixtures'

const mockUseCurrentUser = vi.hoisted(() => vi.fn())

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: vi.fn().mockReturnValue({
    keycloak: { authenticated: true },
    initialized: true
  })
}))

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: mockUseCurrentUser
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
  test.beforeEach(() => {
    mockUseCurrentUser.mockReset()
  })

  describe('currentUser is null', () => {
    test('should render loading', ({ render: renderWithProviders }) => {
      mockUseCurrentUser.mockReturnValue({ data: undefined })
      const { getByTestId } = renderWithProviders(<Role />)

      expect(getByTestId('loading')).toBeInTheDocument()
    })
  })
  describe('currentUser is not null', () => {
    describe('is not authorized', () => {
      test('should render null', async ({ render: renderWithProviders }) => {
        mockUseCurrentUser.mockReturnValue({
          data: { roles: [{ name: 'Government' }] }
        })
        const { container } = renderWithProviders(
          <Role roles={['Director']}>child</Role>
        )

        expect(container.firstChild).toBeNull()
      })
    })
    describe('is authorized', () => {
      test('should render Role', async ({ render: renderWithProviders }) => {
        mockUseCurrentUser.mockReturnValue({
          data: { roles: [{ name: 'Government' }] }
        })
        renderWithProviders(<Role roles={['Government']}>child</Role>)
        expect(await screen.findByText('child')).toBeInTheDocument()
      })
    })
  })
})
