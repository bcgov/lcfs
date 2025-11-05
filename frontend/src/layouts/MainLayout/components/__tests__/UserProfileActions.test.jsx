import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { UserProfileActions } from '../UserProfileActions'
import {
  vi,
  describe,
  it,
  expect,
  beforeEach,
  afterEach
} from 'vitest'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useNotificationsCount } from '@/hooks/useNotifications'
import { wrapper } from '@/tests/utils/wrapper'
import { logout } from '@/utils/keycloak'
import { CONFIG } from '@/constants/config'

const mockRefetch = vi.fn()
const mockRoleSwitcher = vi.fn()
const originalRoleSwitcherFlag = CONFIG.feature_flags.roleSwitcher
const initialHiddenDescriptor = Object.getOwnPropertyDescriptor(
  document,
  'hidden'
)

vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useNotifications')
vi.mock('@/utils/keycloak')

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    NavLink: ({ children, to, ...props }) => (
      <a href={typeof to === 'string' ? to : '#'} {...props}>
        {children}
      </a>
    )
  }
})

vi.mock('../RoleSwitcher', async () => {
  const { CONFIG: actualConfig } = await vi.importActual('@/constants/config')
  return {
    RoleSwitcher: (props) => {
      mockRoleSwitcher(props)
      if (!actualConfig.feature_flags.roleSwitcher) {
        return null
      }
      return <div data-testid="role-switcher" data-open={props.open} />
    }
  }
})

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: { authenticated: true }
  })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('@/components/BCNavbar/components/DefaultNavbarLink', () => ({
  default: ({ icon, route, ...props }) => (
    <div data-test="default-navbar-link" data-route={route} {...props}>
      {icon}
    </div>
  )
}))

describe('UserProfileActions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    CONFIG.feature_flags.roleSwitcher = true
    mockRefetch.mockReset()
    mockRoleSwitcher.mockReset()

    const mockHasRoles = vi.fn((role) => role === 'Administrator')

    vi.mocked(useCurrentUser).mockReturnValue({
      data: {
        firstName: 'John',
        lastName: 'Doe',
        userProfileId: 'user123',
        isGovernmentUser: true,
        organization: { organizationId: 'org123' }
      },
      hasRoles: mockHasRoles
    })

    vi.mocked(useNotificationsCount).mockReturnValue({
      data: { count: 5 },
      isLoading: false,
      refetch: mockRefetch
    })

    vi.mocked(logout).mockImplementation(() => {})
  })

  afterEach(() => {
    CONFIG.feature_flags.roleSwitcher = originalRoleSwitcherFlag
    vi.useRealTimers()
    if (initialHiddenDescriptor) {
      Object.defineProperty(document, 'hidden', initialHiddenDescriptor)
    } else {
      delete document.hidden
    }
  })

  it('renders user information and the logout button', () => {
    render(<UserProfileActions />, { wrapper })

    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'logout' })
    ).toBeInTheDocument()
  })

  it('shows the notifications badge when the count is greater than zero', () => {
    render(<UserProfileActions />, { wrapper })

    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('does not show a badge when notifications count is zero', () => {
    vi.mocked(useNotificationsCount).mockReturnValue({
      data: { count: 0 },
      isLoading: false,
      refetch: mockRefetch
    })

    render(<UserProfileActions />, { wrapper })

    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('shows a loading spinner while notifications are fetching', () => {
    vi.mocked(useNotificationsCount).mockReturnValue({
      data: null,
      isLoading: true,
      refetch: mockRefetch
    })

    render(<UserProfileActions />, { wrapper })

    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('calls logout when the logout button is clicked', () => {
    render(<UserProfileActions />, { wrapper })

    fireEvent.click(screen.getByRole('button', { name: 'logout' }))

    expect(logout).toHaveBeenCalled()
  })

  it('refetches notifications on the manual interval', () => {
    render(<UserProfileActions />, { wrapper })

    act(() => {
      vi.advanceTimersByTime(60000)
    })

    expect(mockRefetch).toHaveBeenCalled()
  })

  it('refetches notifications when the window gains focus', () => {
    render(<UserProfileActions />, { wrapper })

    mockRefetch.mockClear()

    act(() => {
      window.dispatchEvent(new Event('focus'))
    })

    expect(mockRefetch).toHaveBeenCalled()
  })

  it('refetches notifications when the page becomes visible', () => {
    render(<UserProfileActions />, { wrapper })

    mockRefetch.mockClear()

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false
    })

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(mockRefetch).toHaveBeenCalled()
  })

  it('toggles the RoleSwitcher for administrators', () => {
    render(<UserProfileActions />, { wrapper })

    const toggleButton = screen.getByRole('button', {
      name: 'roleSwitcher.buttonLabel'
    })

    expect(mockRoleSwitcher).toHaveBeenCalled()
    const initialProps = mockRoleSwitcher.mock.calls.at(-1)[0]
    expect(initialProps.open).toBe(false)

    fireEvent.click(toggleButton)

    const updatedProps = mockRoleSwitcher.mock.calls.at(-1)[0]
    expect(updatedProps.open).toBe(true)
    expect(updatedProps.anchorEl).toBeInstanceOf(HTMLElement)
  })

  it('does not render the RoleSwitcher toggle for non administrators', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: {
        firstName: 'Jane',
        lastName: 'Smith',
        userProfileId: 'user456',
        isGovernmentUser: true,
        organization: { organizationId: 'org456' }
      },
      hasRoles: () => false
    })

    render(<UserProfileActions />, { wrapper })

    expect(
      screen.queryByRole('button', {
        name: 'roleSwitcher.buttonLabel'
      })
    ).not.toBeInTheDocument()

    expect(mockRoleSwitcher).toHaveBeenCalled()
    const lastCall = mockRoleSwitcher.mock.calls.at(-1)[0]
    expect(lastCall.open).toBe(false)
  })

  it('does not render the RoleSwitcher toggle when the feature flag is disabled', () => {
    CONFIG.feature_flags.roleSwitcher = false

    render(<UserProfileActions />, { wrapper })

    expect(
      screen.queryByRole('button', {
        name: 'roleSwitcher.buttonLabel'
      })
    ).not.toBeInTheDocument()

    expect(mockRoleSwitcher).toHaveBeenCalled()
    const lastCall = mockRoleSwitcher.mock.calls.at(-1)[0] ?? {}
    expect(lastCall.open).toBe(false)
  })

  it('cleans up timers and listeners on unmount', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval')
    const removeDocumentListenerSpy = vi.spyOn(
      document,
      'removeEventListener'
    )
    const removeWindowListenerSpy = vi.spyOn(
      window,
      'removeEventListener'
    )

    const { unmount } = render(<UserProfileActions />, { wrapper })
    unmount()

    expect(clearIntervalSpy).toHaveBeenCalled()
    expect(removeDocumentListenerSpy).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function)
    )
    expect(removeWindowListenerSpy).toHaveBeenCalledWith(
      'focus',
      expect.any(Function)
    )

    clearIntervalSpy.mockRestore()
    removeDocumentListenerSpy.mockRestore()
    removeWindowListenerSpy.mockRestore()
  })
})
