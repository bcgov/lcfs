import { screen, fireEvent, act } from '@testing-library/react'
import { UserProfileActions } from '../UserProfileActions'
import { vi, describe, expect, type Mock } from 'vitest'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useNotificationsCount } from '@/hooks/useNotifications'
import { test } from '@/tests/utils/fixtures'
import { logout } from '@/utils/keycloak'
import { CONFIG } from '@/constants/config'
import type { ReactNode } from 'react'

type RoleSwitcherMockProps = {
  open?: boolean
  anchorEl?: HTMLElement | null
  onToggle?: () => void
  [key: string]: unknown
}

const mockRefetch = vi.fn()
const mockRoleSwitcher = vi.fn<void, [RoleSwitcherMockProps]>()
const originalRoleSwitcherFlag = CONFIG.feature_flags.roleSwitcher
const initialHiddenDescriptor = Object.getOwnPropertyDescriptor(
  document,
  'hidden'
)

const getLastRoleSwitcherProps = () =>
  mockRoleSwitcher.mock.calls.at(-1)?.[0] as RoleSwitcherMockProps | undefined

vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useNotifications')
vi.mock('@/utils/keycloak')

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    NavLink: ({
      children,
      to,
      ...props
    }: {
      children?: ReactNode
      to?: string | Record<string, unknown>
      [key: string]: unknown
    }) => (
      <a href={typeof to === 'string' ? to : '#'} {...props}>
        {children}
      </a>
    )
  }
})

vi.mock('../RoleSwitcher', async () => {
  const { CONFIG: actualConfig } = await vi.importActual('@/constants/config')
  return {
    RoleSwitcher: (props: RoleSwitcherMockProps) => {
      mockRoleSwitcher(props)
      if (!actualConfig.feature_flags.roleSwitcher) {
        return null
      }
      return (
        <>
          <button
            aria-label="roleSwitcher.buttonLabel"
            onClick={props.onToggle as () => void}
          >
            Toggle Role
          </button>
          <div data-testid="role-switcher" data-open={props.open} />
        </>
      )
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
  default: ({
    icon,
    route,
    ...props
  }: {
    icon?: ReactNode
    route?: string
    [key: string]: unknown
  }) => (
    <div data-test="default-navbar-link" data-route={route} {...props}>
      {icon}
    </div>
  )
}))

const mockedUseCurrentUser = useCurrentUser as unknown as Mock
const mockedUseNotificationsCount = useNotificationsCount as unknown as Mock
const mockedLogout = logout as unknown as Mock

describe('UserProfileActions', () => {
  test.beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    CONFIG.feature_flags.roleSwitcher = true
    mockRefetch.mockReset()
    mockRoleSwitcher.mockReset()

    const mockHasRoles = vi.fn((role) => role === 'Administrator')

    mockedUseCurrentUser.mockReturnValue({
      data: {
        firstName: 'John',
        lastName: 'Doe',
        userProfileId: 'user123',
        isGovernmentUser: true,
        organization: { organizationId: 'org123' }
      },
      hasRoles: mockHasRoles
    })

    mockedUseNotificationsCount.mockReturnValue({
      data: { count: 5 },
      isLoading: false,
      refetch: mockRefetch
    })

    mockedLogout.mockImplementation(() => {})
  })

  test.afterEach(() => {
    CONFIG.feature_flags.roleSwitcher = originalRoleSwitcherFlag
    vi.useRealTimers()
    if (initialHiddenDescriptor) {
      Object.defineProperty(document, 'hidden', initialHiddenDescriptor)
    } else {
      delete document.hidden
    }
  })

  test('renders user information and the logout button', ({
    render,
    query,
    theme,
    router
  }) => {
    render(<UserProfileActions />, [query, theme, router])

    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'logout' })).toBeInTheDocument()
  })

  test('shows the notifications badge when the count is greater than zero', ({
    render,
    query,
    theme,
    router
  }) => {
    render(<UserProfileActions />, [query, theme, router])

    expect(screen.getByText('5')).toBeInTheDocument()
  })

  test('does not show a badge when notifications count is zero', ({
    render,
    query,
    theme,
    router
  }) => {
    mockedUseNotificationsCount.mockReturnValue({
      data: { count: 0 },
      isLoading: false,
      refetch: mockRefetch
    })

    render(<UserProfileActions />, [query, theme, router])

    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  test('shows a loading spinner while notifications are fetching', ({
    render,
    query,
    theme,
    router
  }) => {
    mockedUseNotificationsCount.mockReturnValue({
      data: null,
      isLoading: true,
      refetch: mockRefetch
    })

    render(<UserProfileActions />, [query, theme, router])

    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  test('calls logout when the logout button is clicked', ({
    render,
    query,
    theme,
    router
  }) => {
    render(<UserProfileActions />, [query, theme, router])

    fireEvent.click(screen.getByRole('button', { name: 'logout' }))

    expect(mockedLogout).toHaveBeenCalled()
  })

  test('refetches notifications on the manual interval', ({
    render,
    query,
    theme,
    router
  }) => {
    render(<UserProfileActions />, [query, theme, router])

    act(() => {
      vi.advanceTimersByTime(60000)
    })

    expect(mockRefetch).toHaveBeenCalled()
  })

  test('refetches notifications when the window gains focus', ({
    render,
    query,
    theme,
    router
  }) => {
    render(<UserProfileActions />, [query, theme, router])

    mockRefetch.mockClear()

    act(() => {
      window.dispatchEvent(new Event('focus'))
    })

    expect(mockRefetch).toHaveBeenCalled()
  })

  test('refetches notifications when the page becomes visible', ({
    render,
    query,
    theme,
    router
  }) => {
    render(<UserProfileActions />, [query, theme, router])

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

  test('renders the RoleSwitcher with anchor props for administrators', ({
    render,
    query,
    theme,
    router
  }) => {
    const { rerender } = render(<UserProfileActions />, [query, theme, router])

    expect(mockRoleSwitcher).toHaveBeenCalled()
    const initialProps = getLastRoleSwitcherProps()
    expect(initialProps?.open).toBe(false)
    expect(initialProps?.onClose).toBeTypeOf('function')

    rerender(<UserProfileActions />)

    const rerenderedProps = getLastRoleSwitcherProps()
    expect(rerenderedProps?.anchorEl).toBeInstanceOf(HTMLElement)
  })

  test('does not render the RoleSwitcher toggle for non administrators', ({
    render,
    query,
    theme,
    router
  }) => {
    mockedUseCurrentUser.mockReturnValue({
      data: {
        firstName: 'Jane',
        lastName: 'Smith',
        userProfileId: 'user456',
        isGovernmentUser: true,
        organization: { organizationId: 'org456' }
      },
      hasRoles: () => false
    })

    render(<UserProfileActions />, [query, theme, router])

    expect(
      screen.queryByRole('button', {
        name: 'roleSwitcher.buttonLabel'
      })
    ).not.toBeInTheDocument()
  })

  test('does not render the RoleSwitcher toggle when the feature flag is disabled', ({
    render,
    query,
    theme,
    router
  }) => {
    CONFIG.feature_flags.roleSwitcher = false

    render(<UserProfileActions />, [query, theme, router])

    expect(
      screen.queryByRole('button', {
        name: 'roleSwitcher.buttonLabel'
      })
    ).not.toBeInTheDocument()
  })

  test('cleans up timers and listeners on unmount', ({
    render,
    query,
    theme,
    router
  }) => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval')
    const removeDocumentListenerSpy = vi.spyOn(document, 'removeEventListener')
    const removeWindowListenerSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = render(<UserProfileActions />, [query, theme, router])
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
