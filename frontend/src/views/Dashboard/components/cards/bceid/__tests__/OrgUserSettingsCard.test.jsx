import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import OrgUserSettingsCard from '../OrgUserSettingsCard'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/routes/routes'
import { HELP_GUIDE_URL } from '@/constants/common'
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

vi.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: ({ icon, style }) => (
    <span data-test="font-awesome-icon" data-icon={icon?.iconName} style={style}>
      📄
    </span>
  )
}))

vi.mock('@fortawesome/free-solid-svg-icons', () => ({
  faShareFromSquare: { iconName: 'share-from-square' }
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

  it('renders with empty/undefined currentUser data', () => {
    useCurrentUser.mockReturnValue({
      data: null,
      isLoading: false
    })

    render(<OrgUserSettingsCard />, { wrapper })

    expect(screen.getByText('mock__dashboard:orgUserSettings.title')).toBeInTheDocument()
    expect(screen.getByText('mock__dashboard:orgUserSettings.notifications')).toBeInTheDocument()
  })

  it('handles undefined currentUser hook response', () => {
    useCurrentUser.mockReturnValue({
      data: undefined,
      isLoading: false
    })

    render(<OrgUserSettingsCard />, { wrapper })

    expect(screen.getByText('mock__dashboard:orgUserSettings.title')).toBeInTheDocument()
    expect(screen.getByText('mock__dashboard:orgUserSettings.notifications')).toBeInTheDocument()
  })

  it('handles empty firstName and lastName', () => {
    useCurrentUser.mockReturnValue({
      data: {
        firstName: '',
        lastName: '',
        title: 'Developer',
        roles: [{ name: 'Government' }]
      },
      isLoading: false
    })

    render(<OrgUserSettingsCard />, { wrapper })

    expect(screen.getByText('Developer')).toBeInTheDocument()
  })

  it('handles missing all user name fields', () => {
    useCurrentUser.mockReturnValue({
      data: {
        firstName: null,
        lastName: undefined,
        title: '',
        roles: [{ name: 'Government' }]
      },
      isLoading: false
    })

    render(<OrgUserSettingsCard />, { wrapper })

    expect(screen.getByText('mock__dashboard:orgUserSettings.title')).toBeInTheDocument()
    expect(screen.getByText('mock__dashboard:orgUserSettings.notifications')).toBeInTheDocument()
  })

  it('handles only firstName present', () => {
    useCurrentUser.mockReturnValue({
      data: {
        firstName: 'John',
        lastName: null,
        title: null,
        roles: [{ name: 'Government' }]
      },
      isLoading: false
    })

    render(<OrgUserSettingsCard />, { wrapper })

    expect(screen.getByText('John')).toBeInTheDocument()
  })

  it('handles only lastName present', () => {
    useCurrentUser.mockReturnValue({
      data: {
        firstName: null,
        lastName: 'Doe',
        title: null,
        roles: [{ name: 'Government' }]
      },
      isLoading: false
    })

    render(<OrgUserSettingsCard />, { wrapper })

    expect(screen.getByText('Doe')).toBeInTheDocument()
  })

  it('renders external help link with correct attributes', () => {
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

    const helpLink = screen.getByText('mock__dashboard:orgUserSettings.help').closest('a')
    expect(helpLink).toHaveAttribute('href', HELP_GUIDE_URL)
    expect(helpLink).toHaveAttribute('target', '_blank')
    expect(helpLink).toHaveAttribute('rel', 'noreferrer')
  })

  it('renders FontAwesome icon with correct props', () => {
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

    const icon = screen.getByTestId('font-awesome-icon')
    expect(icon).toHaveAttribute('data-icon', 'share-from-square')
    expect(icon).toHaveStyle({ color: '#547D59', marginLeft: '6px' })
  })

  it('renders BCWidgetCard with correct props', () => {
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

    expect(screen.getByText('mock__dashboard:orgUserSettings.title')).toBeInTheDocument()
  })

  it('renders all navigation links', () => {
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

    expect(
      screen.getByText('mock__dashboard:orgUserSettings.notifications')
    ).toBeInTheDocument()
    expect(
      screen.getByText('mock__dashboard:orgUserSettings.configureNotifications')
    ).toBeInTheDocument()
    expect(
      screen.getByText('mock__dashboard:orgUserSettings.help')
    ).toBeInTheDocument()
  })

  it('displays user name in bold with correct color', () => {
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

    const displayName = screen.getByText('Test User, Developer')
    expect(displayName).toBeInTheDocument()
    expect(displayName).toHaveStyle({ color: 'rgb(0, 51, 102)' })
  })
})
