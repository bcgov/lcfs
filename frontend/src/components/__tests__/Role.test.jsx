import { Role } from '@/components/Role'
import * as useCurrentUserHook from '@/hooks/useCurrentUser'
import { wrapper } from '@/tests/utils/wrapper'
import { render, screen } from '@testing-library/react'
import { beforeEach } from 'vitest'

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: vi.fn().mockReturnValue({
    keycloak: { authenticated: true }
  })
}))
vi.mock('@/hooks/useCurrentUser')

describe('Role.jsx', () => {
  describe('currentUser is null', () => {
    beforeEach(async () => {
      vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
        isLoading: true
      })
    })
    it('should render loading', () => {
      const { getByTestId } = render(<Role />, { wrapper })

      expect(getByTestId('loading')).toBeInTheDocument()
    })
  })
  describe('currentUser is not null', () => {
    beforeEach(async () => {
      vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
        isLoading: false,
        data: {
          roles: [{ name: 'Government' }]
        }
      })
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
