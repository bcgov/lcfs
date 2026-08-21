import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserProfileActions } from '@/layouts/MainLayout/components/UserProfileActions'
import { wrapper } from '@/tests/utils/wrapper'
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
  const actual = await vi.importActual<typeof import('@/constants/config')>(
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

  it('renders nothing when keycloak is not authenticated', () => {
    setupMocks({ authenticated: false })
    const { container } = render(<UserProfileActions />, { wrapper })
    expect(container.firstChild).toBeNull()
  })

  it('renders the user full name when authenticated', () => {
    setupMocks({ firstName: 'Alice', lastName: 'Smith' })
    render(<UserProfileActions />, { wrapper })
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
  })

  it('renders a logout button with data-test attribute', () => {
    setupMocks()
    render(<UserProfileActions />, { wrapper })
    const logoutBtn = screen.getByTestId('logout-button')
    expect(logoutBtn).toBeInTheDocument()
  })

  it('calls the keycloak logout utility when the logout button is clicked', () => {
    setupMocks()
    const logoutSpy = vi
      .spyOn(keycloakUtils, 'logout')
      .mockImplementation(() => {})

    render(<UserProfileActions />, { wrapper })
    fireEvent.click(screen.getByTestId('logout-button'))

    expect(logoutSpy).toHaveBeenCalledTimes(1)
    logoutSpy.mockRestore()
  })

  it('renders a notifications link when loaded', () => {
    setupMocks({ isLoading: false, notificationsCount: 3 })
    render(<UserProfileActions />, { wrapper })
    expect(screen.getByLabelText('Notifications')).toBeInTheDocument()
  })

  it('shows a loading spinner instead of notifications when isLoading is true', () => {
    setupMocks({ isLoading: true })
    render(<UserProfileActions />, { wrapper })
    // CircularProgress is rendered when isLoading is true
    expect(screen.queryByLabelText('Notifications')).not.toBeInTheDocument()
  })

  it('does not render role switcher when feature flag is off', () => {
    setupMocks({ isGovernmentUser: true })
    render(<UserProfileActions />, { wrapper })
    expect(screen.queryByTestId('role-switcher')).not.toBeInTheDocument()
  })
})
