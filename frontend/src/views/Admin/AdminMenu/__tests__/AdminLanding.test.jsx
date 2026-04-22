import { render } from '@testing-library/react'
import { vi } from 'vitest'
import { AdminLanding } from '../AdminLanding'

vi.mock('react-router-dom', () => ({
  Navigate: vi.fn(({ to }) => <div data-test="navigate" data-to={to} />)
}))

vi.mock('@/components/Loading', () => ({
  default: vi.fn(() => <div data-test="loading">Loading...</div>)
}))

vi.mock('@/routes/routes', () => ({
  ROUTES: {
    ADMIN: {
      USERS: { LIST: '/admin/users' },
      LOGIN_SCREEN_BACKGROUND: '/admin/login-screen-background'
    },
    DASHBOARD: '/'
  }
}))

vi.mock('@/constants/roles', () => ({
  roles: {
    administrator: 'Administrator',
    system_admin: 'System Admin'
  }
}))

const mockUseCurrentUser = vi.fn()
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockUseCurrentUser()
}))

const makeUser = ({ hasRoles = () => false, isLoading = false, data = {} } = {}) => ({
  data,
  isLoading,
  hasRoles
})

describe('AdminLanding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a loading indicator while the current user is being fetched', () => {
    mockUseCurrentUser.mockReturnValue(
      makeUser({ isLoading: true, data: null })
    )

    const { getByTestId, queryByTestId } = render(<AdminLanding />)

    expect(getByTestId('loading')).toBeInTheDocument()
    expect(queryByTestId('navigate')).not.toBeInTheDocument()
  })

  it('redirects administrators to the users list', () => {
    mockUseCurrentUser.mockReturnValue(
      makeUser({ hasRoles: (role) => role === 'Administrator' })
    )

    const { getByTestId } = render(<AdminLanding />)

    expect(getByTestId('navigate')).toHaveAttribute('data-to', '/admin/users')
  })

  it('redirects system admins (without administrator) to the login screen background page', () => {
    mockUseCurrentUser.mockReturnValue(
      makeUser({ hasRoles: (role) => role === 'System Admin' })
    )

    const { getByTestId } = render(<AdminLanding />)

    expect(getByTestId('navigate')).toHaveAttribute(
      'data-to',
      '/admin/login-screen-background'
    )
  })

  it('prefers the administrator destination when the user has both roles', () => {
    mockUseCurrentUser.mockReturnValue(
      makeUser({
        hasRoles: (role) => role === 'Administrator' || role === 'System Admin'
      })
    )

    const { getByTestId } = render(<AdminLanding />)

    expect(getByTestId('navigate')).toHaveAttribute('data-to', '/admin/users')
  })

  it('falls back to the dashboard for users without any admin privilege', () => {
    mockUseCurrentUser.mockReturnValue(makeUser())

    const { getByTestId } = render(<AdminLanding />)

    expect(getByTestId('navigate')).toHaveAttribute('data-to', '/')
  })
})
