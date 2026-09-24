import { test } from '@/tests/utils/fixtures'
import { screen, fireEvent } from '@testing-library/react'
import { describe, expect, vi, beforeEach } from 'vitest'
import { UserProfileActions } from '@/layouts/MainLayout/components/UserProfileActions'
import * as keycloakUtils from '@/utils/keycloak'
import * as currentUserHooks from '@/hooks/useCurrentUser'
import * as notificationHooks from '@/hooks/useNotifications'
import { roles } from '@/constants/roles'

// Keycloak mock — hoisted so vi.mock can access it
const keycloak = vi.hoisted(() => ({ useKeycloak: vi.fn() }))
vi.mock('@react-keycloak/web', () => keycloak)

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useNotifications')

// Stub heavy sub-components so the test focuses on UserProfileActions logic
vi.mock('@/layouts/MainLayout/components/RoleSwitcher', () => ({
  RoleSwitcher: ({ open }: { open: boolean }) =>
    open ? <div data-test="role-switcher">RoleSwitcher</div> : null
}))

vi.mock('@/constants/config', async () => {
  const actual =
    await vi.importActual<typeof import('@/constants/config')>(
      '@/constants/config'
    )
  return {
    ...actual,
    isFeatureEnabled: vi.fn(() => false)
  }
})

const mockRefetch = vi.fn()

const setupMocks = ({
  authenticated = true,
  firstName = 'Jane',
  lastName = 'Doe',
  isGovernmentUser = false,
  notificationsCount = 0,
  isLoading = false
} = {}) => {
  keycloak.useKeycloak.mockReturnValue({
    keycloak: { authenticated }
  })

  vi.mocked(currentUserHooks.useCurrentUser).mockReturnValue({
    data: authenticated
      ? {
          firstName,
          lastName,
          isGovernmentUser,
          organization: { organizationId: 1 },
          userProfileId: 'user-1'
        }
      : undefined,
    hasRoles: vi.fn((role) => role === roles.government && isGovernmentUser)
  } as any)

  vi.mocked(notificationHooks.useNotificationsCount).mockReturnValue({
    data: { count: notificationsCount },
    isLoading,
    refetch: mockRefetch
  } as any)
}

describe('UserProfileActions (Logout)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders nothing when keycloak is not authenticated', ({
    render,
    query,
    theme,
    router
  }) => {
    setupMocks({ authenticated: false })
    const { container } = render(<UserProfileActions />, [query, theme, router])
    expect(container.firstChild).toBeNull()
  })

  test('renders the user full name when authenticated', ({
    render,
    query,
    theme,
    router
  }) => {
    setupMocks({ firstName: 'Alice', lastName: 'Smith' })
    render(<UserProfileActions />, [query, theme, router])
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
  })

  test('renders a logout button with data-test attribute', ({
    render,
    query,
    theme,
    router
  }) => {
    setupMocks()
    render(<UserProfileActions />, [query, theme, router])
    const logoutBtn = screen.getByTestId('logout-button')
    expect(logoutBtn).toBeInTheDocument()
  })

  test('calls the keycloak logout utility when the logout button is clicked', ({
    render,
    query,
    theme,
    router
  }) => {
    setupMocks()
    const logoutSpy = vi
      .spyOn(keycloakUtils, 'logout')
      .mockImplementation(() => {})

    render(<UserProfileActions />, [query, theme, router])
    fireEvent.click(screen.getByTestId('logout-button'))

    expect(logoutSpy).toHaveBeenCalledTimes(1)
    logoutSpy.mockRestore()
  })

  test('renders a notifications link when loaded', ({
    render,
    query,
    theme,
    router
  }) => {
    setupMocks({ isLoading: false, notificationsCount: 3 })
    render(<UserProfileActions />, [query, theme, router])
    expect(screen.getByLabelText('Notifications')).toBeInTheDocument()
  })

  test('shows a loading spinner instead of notifications when isLoading is true', ({
    render,
    query,
    theme,
    router
  }) => {
    setupMocks({ isLoading: true })
    render(<UserProfileActions />, [query, theme, router])
    // CircularProgress is rendered when isLoading is true
    expect(screen.queryByLabelText('Notifications')).not.toBeInTheDocument()
  })

  test('does not render role switcher when feature flag is off', ({
    render,
    query,
    theme,
    router
  }) => {
    setupMocks({ isGovernmentUser: true })
    render(<UserProfileActions />, [query, theme, router])
    expect(screen.queryByTestId('role-switcher')).not.toBeInTheDocument()
  })
})
