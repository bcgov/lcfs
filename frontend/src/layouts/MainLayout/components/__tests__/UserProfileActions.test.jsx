import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { UserProfileActions } from '../UserProfileActions'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useNotificationsCount } from '@/hooks/useNotifications'
import { useLocation } from 'react-router-dom'
import { wrapper } from '@/tests/utils/wrapper'
import { ROUTES } from '@/routes/routes'
import { logout } from '@/utils/keycloak'

// Mock variables - must be declared at top level
const mockRefetch = vi.fn()
const mockUseLocation = vi.fn()

// Mock hooks and components
vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useNotifications')
vi.mock('@/utils/keycloak')

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useLocation: () => mockUseLocation(),
    NavLink: ({ children, to, ...props }) => (
      <a href={to} {...props}>
        {children}
      </a>
    )
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

// Mock components
vi.mock('@/components/BCNavbar/components/DefaultNavbarLink', () => ({
  default: ({ icon, route, ...props }) => (
    <div data-test="default-navbar-link" data-route={route} {...props}>
      {icon}
    </div>
  )
}))

describe('UserProfileActions', () => {
  // Mock timers
  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetAllMocks()

    // Setup default mocks
    mockUseLocation.mockReturnValue({ pathname: '/' })

    vi.mocked(useCurrentUser).mockReturnValue({
      data: {
        firstName: 'John',
        lastName: 'Doe',
        userProfileId: 'user123',
        isGovernmentUser: true,
        organization: { organizationId: 'org123' }
      }
    })

    vi.mocked(useNotificationsCount).mockReturnValue({
      data: { count: 5 },
      isLoading: false,
      refetch: mockRefetch
    })

    vi.mocked(logout).mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders user profile with notifications', () => {
    render(<UserProfileActions />, { wrapper })

    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('logout')).toBeInTheDocument()
  })

  it('shows notifications count badge', () => {
    render(<UserProfileActions />, { wrapper })

    // The badge should show the count
    const badge = screen.getByText('5')
    expect(badge).toBeInTheDocument()
  })

  it('does not show badge when count is 0', () => {
    vi.mocked(useNotificationsCount).mockReturnValue({
      data: { count: 0 },
      isLoading: false,
      refetch: mockRefetch
    })

    render(<UserProfileActions />, { wrapper })

    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('shows loading spinner when notifications are loading', () => {
    vi.mocked(useNotificationsCount).mockReturnValue({
      data: null,
      isLoading: true,
      refetch: mockRefetch
    })

    render(<UserProfileActions />, { wrapper })

    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('calls logout when logout button is clicked', () => {
    render(<UserProfileActions />, { wrapper })

    const logoutButton = screen.getByTestId('logout-button')
    fireEvent.click(logoutButton)

    expect(logout).toHaveBeenCalled()
  })

  it('sets up interval for refetching notifications', () => {
    render(<UserProfileActions />, { wrapper })

    // Fast-forward time by 1 minute
    act(() => {
      vi.advanceTimersByTime(60000)
    })

    expect(mockRefetch).toHaveBeenCalled()
  })

  it('refetches notifications on window focus', () => {
    render(<UserProfileActions />, { wrapper })

    // Clear initial calls
    mockRefetch.mockClear()

    // Simulate window focus event
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })

    expect(mockRefetch).toHaveBeenCalled()
  })

  it('refetches notifications when page becomes visible', () => {
    render(<UserProfileActions />, { wrapper })

    // Clear initial calls
    mockRefetch.mockClear()

    // Mock document.hidden to return false (page is visible)
    Object.defineProperty(document, 'hidden', {
      writable: true,
      value: false
    })

    // Simulate visibility change event
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(mockRefetch).toHaveBeenCalled()
  })

  it('does not refetch when page is hidden', () => {
    render(<UserProfileActions />, { wrapper })

    // Clear initial calls
    mockRefetch.mockClear()

    // Mock document.hidden to return true (page is hidden)
    Object.defineProperty(document, 'hidden', {
      writable: true,
      value: true
    })

    // Simulate visibility change event
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(mockRefetch).not.toHaveBeenCalled()
  })

  it('renders correct user profile link for government user', () => {
    render(<UserProfileActions />, { wrapper })

    const userLink = screen.getByText('John Doe')
    expect(userLink.getAttribute('href')).toContain('/admin/users/user123')
  })

  it('does not render user name when firstName is not available', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: {
        firstName: null,
        lastName: 'Doe',
        userProfileId: 'user123',
        isGovernmentUser: true,
        organization: { organizationId: 'org123' }
      }
    })

    render(<UserProfileActions />, { wrapper })

    expect(screen.queryByText('Doe')).not.toBeInTheDocument()
    expect(screen.getByText('logout')).toBeInTheDocument()
  })

  it('handles missing notifications data gracefully', () => {
    vi.mocked(useNotificationsCount).mockReturnValue({
      data: null,
      isLoading: false,
      refetch: mockRefetch
    })

    render(<UserProfileActions />, { wrapper })

    // Should not show any notification count
    expect(screen.queryByText(/\d/)).not.toBeInTheDocument()
  })

  it('cleans up intervals on unmount', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval')

    const { unmount } = render(<UserProfileActions />, { wrapper })
    unmount()

    expect(clearIntervalSpy).toHaveBeenCalled()
  })

  it('cleans up event listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')
    const windowRemoveEventListenerSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = render(<UserProfileActions />, { wrapper })
    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function)
    )
    expect(windowRemoveEventListenerSpy).toHaveBeenCalledWith(
      'focus',
      expect.any(Function)
    )
  })
})
