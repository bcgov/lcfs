import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import OrgUserSettingsCard from '../OrgUserSettingsCard'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/routes/routes'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('@/hooks/useCurrentUser')

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => `mock__${key}`
  })
}))

vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useNavigate: vi.fn()
}))

vi.mock('@/utils/withRole', () => ({
  __esModule: true,
  default: (Component) =>
    function MockWithRole(props) {
      return <Component {...props} />
    }
}))

describe('OrgUserSettingsCard', () => {
  const mockNavigate = vi.fn()

  beforeEach(() => {
    mockNavigate.mockClear()
    useNavigate.mockReturnValue(mockNavigate)
  })

  it('renders the user’s full name and title correctly', () => {
    useCurrentUser.mockReturnValue({
      data: {
        firstName: 'Test',
        lastName: 'User',
        title: 'Developer',
        roles: [{ name: 'Government' }]
      },
      isLoading: false
    })

    render(<OrgUserSettingsCard />, { wrapper })

    expect(screen.getByText('Test User, Developer')).toBeInTheDocument()

    expect(
      screen.getByText('mock__dashboard:orgUserSettings.notifications')
    ).toBeInTheDocument()
    expect(
      screen.getByText('mock__dashboard:orgUserSettings.configureNotifications')
    ).toBeInTheDocument()
  })

  it('handles missing title gracefully', () => {
    useCurrentUser.mockReturnValue({
      data: {
        firstName: 'Test',
        lastName: 'User',
        title: undefined,
        roles: [{ name: 'Government' }]
      },
      isLoading: false
    })

    render(<OrgUserSettingsCard />, { wrapper })

    // Should be "Test User" with no comma
    expect(screen.getByText('Test User')).toBeInTheDocument()
  })

  it('handles missing firstName or lastName gracefully', () => {
    useCurrentUser.mockReturnValue({
      data: {
        firstName: 'Test',
        lastName: '',
        title: 'Developer',
        roles: [{ name: 'Government' }]
      },
      isLoading: false
    })

    render(<OrgUserSettingsCard />, { wrapper })

    // Should show "Test, Developer"
    expect(screen.getByText('Test, Developer')).toBeInTheDocument()
  })

  it('navigates to Notifications page when "mock__dashboard:orgUserSettings.notifications" is clicked', () => {
    useCurrentUser.mockReturnValue({
      data: {
        firstName: 'Test',
        lastName: 'User',
        title: 'Dev',
        roles: [{ name: 'Government' }]
      },
      isLoading: false
    })

    render(<OrgUserSettingsCard />, { wrapper })

    const notificationsLink = screen.getByText(
      'mock__dashboard:orgUserSettings.notifications'
    )
    fireEvent.click(notificationsLink)

    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.NOTIFICATIONS.LIST)
  })

  it('navigates to Notifications Settings page when "mock__dashboard:orgUserSettings.configureNotifications" is clicked', () => {
    useCurrentUser.mockReturnValue({
      data: {
        firstName: 'Test',
        lastName: 'User',
        title: 'Dev',
        roles: [{ name: 'Government' }]
      },
      isLoading: false
    })

    render(<OrgUserSettingsCard />, { wrapper })

    const configureLink = screen.getByText(
      'mock__dashboard:orgUserSettings.configureNotifications'
    )
    fireEvent.click(configureLink)

    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.NOTIFICATIONS.SETTINGS)
  })
})
