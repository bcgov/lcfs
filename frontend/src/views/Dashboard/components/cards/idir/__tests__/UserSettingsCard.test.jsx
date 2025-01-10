import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import UserSettingsCard from '../UserSettingsCard'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'
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

describe('UserSettingsCard', () => {
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

    render(<UserSettingsCard />, { wrapper })

    expect(screen.getByText('Test User, Developer')).toBeInTheDocument()

    expect(
      screen.getByText('mock__dashboard:userSettings.notifications')
    ).toBeInTheDocument()
    expect(
      screen.getByText('mock__dashboard:userSettings.configureNotifications')
    ).toBeInTheDocument()
    expect(
      screen.getByText('mock__dashboard:userSettings.help')
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

    render(<UserSettingsCard />, { wrapper })

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

    render(<UserSettingsCard />, { wrapper })

    // Should show "Test, Developer"
    expect(screen.getByText('Test, Developer')).toBeInTheDocument()
  })

  it('navigates to Notifications page when "mock__dashboard:userSettings.notifications" is clicked', () => {
    useCurrentUser.mockReturnValue({
      data: {
        firstName: 'Test',
        lastName: 'User',
        title: 'Dev',
        roles: [{ name: 'Government' }]
      },
      isLoading: false
    })

    render(<UserSettingsCard />, { wrapper })

    const notificationsLink = screen.getByText(
      'mock__dashboard:userSettings.notifications'
    )
    fireEvent.click(notificationsLink)

    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.NOTIFICATIONS)
  })

  it('navigates to Notifications Settings page when "mock__dashboard:userSettings.configureNotifications" is clicked', () => {
    useCurrentUser.mockReturnValue({
      data: {
        firstName: 'Test',
        lastName: 'User',
        title: 'Dev',
        roles: [{ name: 'Government' }]
      },
      isLoading: false
    })

    render(<UserSettingsCard />, { wrapper })

    const configureLink = screen.getByText(
      'mock__dashboard:userSettings.configureNotifications'
    )
    fireEvent.click(configureLink)

    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.NOTIFICATIONS_SETTINGS)
  })

  it('navigates to the help page (placeholder) when "mock__dashboard:userSettings.help" is clicked', () => {
    useCurrentUser.mockReturnValue({
      data: {
        firstName: 'Test',
        lastName: 'User',
        title: 'Dev',
        roles: [{ name: 'Government' }]
      },
      isLoading: false
    })

    render(<UserSettingsCard />, { wrapper })

    const helpLink = screen.getByText('mock__dashboard:userSettings.help')
    fireEvent.click(helpLink)

    // By default, it calls navigate() with no args
    expect(mockNavigate).toHaveBeenCalled()
  })
})
