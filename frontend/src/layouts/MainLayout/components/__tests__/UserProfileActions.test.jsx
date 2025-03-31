import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { UserProfileActions } from '../UserProfileActions'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useNotificationsCount } from '@/hooks/useNotifications'
import { useLocation } from 'react-router-dom'
import { wrapper } from '@/tests/utils/wrapper'
import { ROUTES } from '@/routes/routes'
import { logout } from '@/utils/keycloak'

// Mock hooks and components
vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useNotifications')
vi.mock('@/utils/keycloak')
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useLocation: vi.fn()
  }
})
vi.mock('@react-keycloak/web', () => ({
  useKeycloak: vi.fn().mockReturnValue({
    keycloak: { authenticated: true }
  })
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => (key === 'Notifications' ? 'Notifications' : key)
  })
}))

describe('UserProfileActions', () => {
  const mockRefetch = vi.fn()

  beforeEach(() => {
    // Set up default mock data
    useCurrentUser.mockReturnValue({
      data: {
        firstName: 'John',
        lastName: 'Doe',
        isGovernmentUser: true,
        userProfileId: '123'
      }
    })

    useNotificationsCount.mockReturnValue({
      data: { count: 3 },
      isLoading: false,
      refetch: mockRefetch
    })

    useLocation.mockReturnValue({ pathname: '/dashboard' })
  })

  it('renders the user name', () => {
    render(<UserProfileActions />, { wrapper })

    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })

  it('renders the notification count badge when there are notifications', () => {
    render(<UserProfileActions />, { wrapper })

    const badge = screen.getByLabelText('Notifications')
    expect(badge).toBeInTheDocument()
    // The badge text should show the count
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('does not show notification count when count is zero', () => {
    useNotificationsCount.mockReturnValue({
      data: { count: 0 },
      isLoading: false,
      refetch: mockRefetch
    })

    render(<UserProfileActions />, { wrapper })

    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('shows loading indicator when notifications are loading', () => {
    useNotificationsCount.mockReturnValue({
      isLoading: true,
      refetch: mockRefetch
    })

    render(<UserProfileActions />, { wrapper })

    // Check for CircularProgress
    expect(
      document.querySelector('[class*="MuiCircularProgress-root"]')
    ).toBeInTheDocument()
  })

  it('calls logout function when logout button is clicked', () => {
    render(<UserProfileActions />, { wrapper })

    fireEvent.click(screen.getByText('logout'))

    expect(logout).toHaveBeenCalled()
  })

  it('refetches notifications when location changes', () => {
    render(<UserProfileActions />, { wrapper })

    // Verify that refetch was called during initial render
    expect(mockRefetch).toHaveBeenCalled()

    // Clear the mock calls
    mockRefetch.mockClear()

    // Simulate location change
    useLocation.mockReturnValue({ pathname: '/new-path' })

    // Re-render the component with new location
    const { rerender } = render(<UserProfileActions />, { wrapper })
    rerender(<UserProfileActions />)

    // Verify refetch was called again
    expect(mockRefetch).toHaveBeenCalled()
  })

  it('links to correct user profile based on user type', () => {
    // Test for government user
    render(<UserProfileActions />, { wrapper })

    const profileLink = screen.getByText('John Doe')
    expect(profileLink).toHaveAttribute(
      'href',
      ROUTES.ADMIN.USERS.VIEW.replace(':userID', '123')
    )

    // Test for non-government user
    useCurrentUser.mockReturnValue({
      data: {
        firstName: 'Jane',
        lastName: 'Smith',
        isGovernmentUser: false,
        userProfileId: '456',
        organization: {
          organizationId: '789'
        }
      }
    })

    const { rerender } = render(<UserProfileActions />, { wrapper })
    rerender(<UserProfileActions />)

    const nonGovProfileLink = screen.getByText('Jane Smith')
    expect(nonGovProfileLink).toHaveAttribute(
      'href',
      ROUTES.ORGANIZATION.VIEW_USER.replace(':orgID', '789').replace(
        ':userID',
        '456'
      )
    )
  })
})
