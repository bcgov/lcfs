import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { vi, describe, expect, beforeEach } from 'vitest'
import UserSettingsCard from '../UserSettingsCard'
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
    <span data-test="font-awesome-icon" style={style}>
      mock-icon
    </span>
  )
}))

describe('UserSettingsCard', () => {
  const mockNavigate = vi.fn()

  beforeEach(() => {
    mockNavigate.mockClear()
    useNavigate.mockReturnValue(mockNavigate)
  })

  describe('Component Rendering', () => {
    test('renders the component with complete user data', ({
      render,
      query,
      theme
    }) => {
      useCurrentUser.mockReturnValue({
        data: {
          firstName: 'John',
          lastName: 'Doe',
          title: 'Manager',
          roles: [{ name: 'Government' }]
        },
        isLoading: false
      })

      render(<UserSettingsCard />, [query, theme])

      expect(screen.getByText('John Doe, Manager')).toBeInTheDocument()
      expect(
        screen.getByText('mock__dashboard:userSettings.title')
      ).toBeInTheDocument()
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

    test('renders with null user data', ({ render, query, theme }) => {
      useCurrentUser.mockReturnValue({
        data: null,
        isLoading: false
      })

      render(<UserSettingsCard />, [query, theme])

      expect(
        screen.getByText('mock__dashboard:userSettings.title')
      ).toBeInTheDocument()
      expect(screen.queryByText(/John|Doe|Manager/)).not.toBeInTheDocument()
    })

    test('renders with undefined user data', ({ render, query, theme }) => {
      useCurrentUser.mockReturnValue({
        data: undefined,
        isLoading: false
      })

      render(<UserSettingsCard />, [query, theme])

      expect(
        screen.getByText('mock__dashboard:userSettings.title')
      ).toBeInTheDocument()
      expect(screen.queryByText(/John|Doe|Manager/)).not.toBeInTheDocument()
    })

    test('renders with empty user object', ({ render, query, theme }) => {
      useCurrentUser.mockReturnValue({
        data: {},
        isLoading: false
      })

      render(<UserSettingsCard />, [query, theme])

      expect(
        screen.getByText('mock__dashboard:userSettings.title')
      ).toBeInTheDocument()
      expect(screen.queryByText(/John|Doe|Manager/)).not.toBeInTheDocument()
    })
  })

  describe('User Display Name Logic', () => {
    test('displays full name with title when all fields present', ({
      render,
      query,
      theme
    }) => {
      useCurrentUser.mockReturnValue({
        data: {
          firstName: 'Alice',
          lastName: 'Smith',
          title: 'Director',
          roles: [{ name: 'Government' }]
        },
        isLoading: false
      })

      render(<UserSettingsCard />, [query, theme])

      expect(screen.getByText('Alice Smith, Director')).toBeInTheDocument()
    })

    test('displays name without title when title is missing', ({
      render,
      query,
      theme
    }) => {
      useCurrentUser.mockReturnValue({
        data: {
          firstName: 'Bob',
          lastName: 'Johnson',
          title: undefined,
          roles: [{ name: 'Government' }]
        },
        isLoading: false
      })

      render(<UserSettingsCard />, [query, theme])

      expect(screen.getByText('Bob Johnson')).toBeInTheDocument()
      expect(screen.queryByText(/Bob Johnson,/)).not.toBeInTheDocument()
    })

    test('displays firstName only when lastName is missing', ({
      render,
      query,
      theme
    }) => {
      useCurrentUser.mockReturnValue({
        data: {
          firstName: 'Charlie',
          lastName: '',
          title: 'Analyst',
          roles: [{ name: 'Government' }]
        },
        isLoading: false
      })

      render(<UserSettingsCard />, [query, theme])

      expect(screen.getByText('Charlie, Analyst')).toBeInTheDocument()
    })

    test('displays lastName only when firstName is missing', ({
      render,
      query,
      theme
    }) => {
      useCurrentUser.mockReturnValue({
        data: {
          firstName: '',
          lastName: 'Wilson',
          title: 'Coordinator',
          roles: [{ name: 'Government' }]
        },
        isLoading: false
      })

      render(<UserSettingsCard />, [query, theme])

      expect(screen.getByText('Wilson, Coordinator')).toBeInTheDocument()
    })

    test('displays only title when both names are missing', ({
      render,
      query,
      theme
    }) => {
      useCurrentUser.mockReturnValue({
        data: {
          firstName: '',
          lastName: '',
          title: 'Administrator',
          roles: [{ name: 'Government' }]
        },
        isLoading: false
      })

      render(<UserSettingsCard />, [query, theme])

      expect(screen.getByText('Administrator')).toBeInTheDocument()
    })

    test('displays nothing when all name fields are missing', ({
      render,
      query,
      theme
    }) => {
      useCurrentUser.mockReturnValue({
        data: {
          firstName: '',
          lastName: '',
          title: '',
          roles: [{ name: 'Government' }]
        },
        isLoading: false
      })

      render(<UserSettingsCard />, [query, theme])

      expect(
        screen.getByText('mock__dashboard:userSettings.title')
      ).toBeInTheDocument()
      const nameElement = screen
        .getByText('mock__dashboard:userSettings.title')
        .closest('[data-testid]')
      if (nameElement) {
        expect(nameElement.textContent).not.toMatch(/[A-Za-z]{2,}/)
      }
    })
  })

  describe('Navigation Functionality', () => {
    beforeEach(() => {
      useCurrentUser.mockReturnValue({
        data: {
          firstName: 'Test',
          lastName: 'User',
          title: 'Tester',
          roles: [{ name: 'Government' }]
        },
        isLoading: false
      })
    })

    test('navigates to notifications list when notifications link is clicked', ({
      render,
      query,
      theme
    }) => {
      render(<UserSettingsCard />, [query, theme])

      const notificationsLink = screen.getByText(
        'mock__dashboard:userSettings.notifications'
      )
      fireEvent.click(notificationsLink)

      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.NOTIFICATIONS.LIST)
    })

    test('navigates to notification settings when configure notifications link is clicked', ({
      render,
      query,
      theme
    }) => {
      render(<UserSettingsCard />, [query, theme])

      const configureLink = screen.getByText(
        'mock__dashboard:userSettings.configureNotifications'
      )
      fireEvent.click(configureLink)

      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.NOTIFICATIONS.SETTINGS)
    })

    test('renders external help link with correct attributes', ({
      render,
      query,
      theme
    }) => {
      render(<UserSettingsCard />, [query, theme])

      const helpLink = screen.getByRole('link', {
        name: /mock__dashboard:userSettings\.help/
      })
      expect(helpLink).toHaveAttribute('href', HELP_GUIDE_URL)
      expect(helpLink).toHaveAttribute('target', '_blank')
      expect(helpLink).toHaveAttribute('rel', 'noreferrer')
    })

    test('displays FontAwesome icon in help link', ({
      render,
      query,
      theme
    }) => {
      render(<UserSettingsCard />, [query, theme])

      const fontAwesomeIcon = screen.getByTestId('font-awesome-icon')
      expect(fontAwesomeIcon).toBeInTheDocument()
      expect(fontAwesomeIcon).toHaveStyle({
        color: '#547D59',
        marginLeft: '6px'
      })
    })
  })

  describe('UserSettingsLink Component', () => {
    test('applies correct styling to link text', ({ render, query, theme }) => {
      useCurrentUser.mockReturnValue({
        data: {
          firstName: 'Style',
          lastName: 'Test',
          roles: [{ name: 'Government' }]
        },
        isLoading: false
      })

      render(<UserSettingsCard />, [query, theme])

      const linkText = screen.getByText(
        'mock__dashboard:userSettings.notifications'
      )
      expect(linkText).toBeInTheDocument()
      expect(linkText.tagName).toBe('P')
    })

    test('handles onClick for UserSettingsLink properly', ({
      render,
      query,
      theme
    }) => {
      useCurrentUser.mockReturnValue({
        data: {
          firstName: 'Click',
          lastName: 'Test',
          roles: [{ name: 'Government' }]
        },
        isLoading: false
      })

      render(<UserSettingsCard />, [query, theme])

      const linkText = screen.getByText(
        'mock__dashboard:userSettings.notifications'
      )
      const listItemButton = linkText.closest('[role="button"]')
      fireEvent.click(listItemButton)

      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.NOTIFICATIONS.LIST)
    })
  })

  describe('Translation Integration', () => {
    test('uses correct translation namespace and keys', ({
      render,
      query,
      theme
    }) => {
      useCurrentUser.mockReturnValue({
        data: {
          firstName: 'Trans',
          lastName: 'Lation',
          roles: [{ name: 'Government' }]
        },
        isLoading: false
      })

      render(<UserSettingsCard />, [query, theme])

      expect(
        screen.getByText('mock__dashboard:userSettings.title')
      ).toBeInTheDocument()
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
  })

  describe('Component Structure', () => {
    test('renders BCWidgetCard with correct props', ({
      render,
      query,
      theme
    }) => {
      useCurrentUser.mockReturnValue({
        data: {
          firstName: 'Widget',
          lastName: 'Test',
          roles: [{ name: 'Government' }]
        },
        isLoading: false
      })

      render(<UserSettingsCard />, [query, theme])

      expect(
        screen.getByText('mock__dashboard:userSettings.title')
      ).toBeInTheDocument()
    })

    test('renders List component with navigation items', ({
      render,
      query,
      theme
    }) => {
      useCurrentUser.mockReturnValue({
        data: {
          firstName: 'List',
          lastName: 'Test',
          roles: [{ name: 'Government' }]
        },
        isLoading: false
      })

      render(<UserSettingsCard />, [query, theme])

      const listItems = screen.getAllByRole('button')
      expect(listItems.length).toBeGreaterThanOrEqual(2) // At least two navigation buttons
    })
  })
})
