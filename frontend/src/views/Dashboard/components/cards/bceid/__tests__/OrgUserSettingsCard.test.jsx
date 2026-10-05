import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { vi, describe, expect, beforeEach } from 'vitest'
import OrgUserSettingsCard from '../OrgUserSettingsCard'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/routes/routes'
import { HELP_GUIDE_URL } from '@/constants/common'
import { test } from '@/tests/utils/fixtures'

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
    <span
      data-test="font-awesome-icon"
      data-icon={icon?.iconName}
      style={style}
    >
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

  test('renders the user’s full name and title correctly', ({
    render,
    query,
    theme
  }) => {
    useCurrentUser.mockReturnValue({
      data: {
        firstName: 'Test',
        lastName: 'User',
        title: 'Developer',
        roles: [{ name: 'Government' }]
      },
      isLoading: false
    })

    render(<OrgUserSettingsCard />, [query, theme])

    expect(screen.getByText('Test User, Developer')).toBeInTheDocument()

    expect(
      screen.getByText('mock__dashboard:orgUserSettings.notifications')
    ).toBeInTheDocument()
    expect(
      screen.getByText('mock__dashboard:orgUserSettings.configureNotifications')
    ).toBeInTheDocument()
  })

  test('handles missing title gracefully', ({ render, query, theme }) => {
    useCurrentUser.mockReturnValue({
      data: {
        firstName: 'Test',
        lastName: 'User',
        title: undefined,
        roles: [{ name: 'Government' }]
      },
      isLoading: false
    })

    render(<OrgUserSettingsCard />, [query, theme])

    // Should be "Test User" with no comma
    expect(screen.getByText('Test User')).toBeInTheDocument()
  })

  test('handles missing firstName or lastName gracefully', ({
    render,
    query,
    theme
  }) => {
    useCurrentUser.mockReturnValue({
      data: {
        firstName: 'Test',
        lastName: '',
        title: 'Developer',
        roles: [{ name: 'Government' }]
      },
      isLoading: false
    })

    render(<OrgUserSettingsCard />, [query, theme])

    // Should show "Test, Developer"
    expect(screen.getByText('Test, Developer')).toBeInTheDocument()
  })

  test('navigates to Notifications page when "mock__dashboard:orgUserSettings.notifications" is clicked', ({
    render,
    query,
    theme
  }) => {
    useCurrentUser.mockReturnValue({
      data: {
        firstName: 'Test',
        lastName: 'User',
        title: 'Dev',
        roles: [{ name: 'Government' }]
      },
      isLoading: false
    })

    render(<OrgUserSettingsCard />, [query, theme])

    const notificationsLink = screen.getByText(
      'mock__dashboard:orgUserSettings.notifications'
    )
    fireEvent.click(notificationsLink)

    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.NOTIFICATIONS.LIST)
  })

  test('navigates to Notifications Settings page when "mock__dashboard:orgUserSettings.configureNotifications" is clicked', ({
    render,
    query,
    theme
  }) => {
    useCurrentUser.mockReturnValue({
      data: {
        firstName: 'Test',
        lastName: 'User',
        title: 'Dev',
        roles: [{ name: 'Government' }]
      },
      isLoading: false
    })

    render(<OrgUserSettingsCard />, [query, theme])

    const configureLink = screen.getByText(
      'mock__dashboard:orgUserSettings.configureNotifications'
    )
    fireEvent.click(configureLink)

    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.NOTIFICATIONS.SETTINGS)
  })

  test('renders with empty/undefined currentUser data', ({
    render,
    query,
    theme
  }) => {
    useCurrentUser.mockReturnValue({
      data: null,
      isLoading: false
    })

    render(<OrgUserSettingsCard />, [query, theme])

    expect(
      screen.getByText('mock__dashboard:orgUserSettings.title')
    ).toBeInTheDocument()
    expect(
      screen.getByText('mock__dashboard:orgUserSettings.notifications')
    ).toBeInTheDocument()
  })

  test('handles undefined currentUser hook response', ({
    render,
    query,
    theme
  }) => {
    useCurrentUser.mockReturnValue({
      data: undefined,
      isLoading: false
    })

    render(<OrgUserSettingsCard />, [query, theme])

    expect(
      screen.getByText('mock__dashboard:orgUserSettings.title')
    ).toBeInTheDocument()
    expect(
      screen.getByText('mock__dashboard:orgUserSettings.notifications')
    ).toBeInTheDocument()
  })

  test('handles empty firstName and lastName', ({ render, query, theme }) => {
    useCurrentUser.mockReturnValue({
      data: {
        firstName: '',
        lastName: '',
        title: 'Developer',
        roles: [{ name: 'Government' }]
      },
      isLoading: false
    })

    render(<OrgUserSettingsCard />, [query, theme])

    expect(screen.getByText('Developer')).toBeInTheDocument()
  })

  test('handles missing all user name fields', ({ render, query, theme }) => {
    useCurrentUser.mockReturnValue({
      data: {
        firstName: null,
        lastName: undefined,
        title: '',
        roles: [{ name: 'Government' }]
      },
      isLoading: false
    })

    render(<OrgUserSettingsCard />, [query, theme])

    expect(
      screen.getByText('mock__dashboard:orgUserSettings.title')
    ).toBeInTheDocument()
    expect(
      screen.getByText('mock__dashboard:orgUserSettings.notifications')
    ).toBeInTheDocument()
  })

  test('handles only firstName present', ({ render, query, theme }) => {
    useCurrentUser.mockReturnValue({
      data: {
        firstName: 'John',
        lastName: null,
        title: null,
        roles: [{ name: 'Government' }]
      },
      isLoading: false
    })

    render(<OrgUserSettingsCard />, [query, theme])

    expect(screen.getByText('John')).toBeInTheDocument()
  })

  test('handles only lastName present', ({ render, query, theme }) => {
    useCurrentUser.mockReturnValue({
      data: {
        firstName: null,
        lastName: 'Doe',
        title: null,
        roles: [{ name: 'Government' }]
      },
      isLoading: false
    })

    render(<OrgUserSettingsCard />, [query, theme])

    expect(screen.getByText('Doe')).toBeInTheDocument()
  })

  test('renders external help link with correct attributes', ({
    render,
    query,
    theme
  }) => {
    useCurrentUser.mockReturnValue({
      data: {
        firstName: 'Test',
        lastName: 'User',
        title: 'Developer',
        roles: [{ name: 'Government' }]
      },
      isLoading: false
    })

    render(<OrgUserSettingsCard />, [query, theme])

    const helpLink = screen
      .getByText('mock__dashboard:orgUserSettings.help')
      .closest('a')
    expect(helpLink).toHaveAttribute('href', HELP_GUIDE_URL)
    expect(helpLink).toHaveAttribute('target', '_blank')
    expect(helpLink).toHaveAttribute('rel', 'noreferrer')
  })

  test('renders FontAwesome icon with correct props', ({
    render,
    query,
    theme
  }) => {
    useCurrentUser.mockReturnValue({
      data: {
        firstName: 'Test',
        lastName: 'User',
        title: 'Developer',
        roles: [{ name: 'Government' }]
      },
      isLoading: false
    })

    render(<OrgUserSettingsCard />, [query, theme])

    const icon = screen.getByTestId('font-awesome-icon')
    expect(icon).toHaveAttribute('data-icon', 'share-from-square')
    expect(icon).toHaveStyle({ color: '#547D59', marginLeft: '6px' })
  })

  test('renders BCWidgetCard with correct props', ({
    render,
    query,
    theme
  }) => {
    useCurrentUser.mockReturnValue({
      data: {
        firstName: 'Test',
        lastName: 'User',
        title: 'Developer',
        roles: [{ name: 'Government' }]
      },
      isLoading: false
    })

    render(<OrgUserSettingsCard />, [query, theme])

    expect(
      screen.getByText('mock__dashboard:orgUserSettings.title')
    ).toBeInTheDocument()
  })

  test('renders all navigation links', ({ render, query, theme }) => {
    useCurrentUser.mockReturnValue({
      data: {
        firstName: 'Test',
        lastName: 'User',
        title: 'Developer',
        roles: [{ name: 'Government' }]
      },
      isLoading: false
    })

    render(<OrgUserSettingsCard />, [query, theme])

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

  test('displays user name in bold with correct color', ({
    render,
    query,
    theme
  }) => {
    useCurrentUser.mockReturnValue({
      data: {
        firstName: 'Test',
        lastName: 'User',
        title: 'Developer',
        roles: [{ name: 'Government' }]
      },
      isLoading: false
    })

    render(<OrgUserSettingsCard />, [query, theme])

    const displayName = screen.getByText('Test User, Developer')
    expect(displayName).toBeInTheDocument()
    expect(displayName).toHaveStyle({ color: 'rgb(0, 51, 102)' })
  })
})
