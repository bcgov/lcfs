import { screen, fireEvent } from '@testing-library/react'
import { vi, describe, expect, beforeEach } from 'vitest'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ROUTES } from '@/routes/routes'
import { roles } from '@/constants/roles'
import { test } from '@/tests/utils/fixtures'

// Mock dependencies
vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useNavigate: vi.fn()
}))

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn()
}))

vi.mock('@/utils/withRole', () => ({
  __esModule: true,
  default: vi.fn((Component) => Component)
}))

const mockHasRoles = vi.fn()
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    hasRoles: mockHasRoles
  })
}))

// Mock components
vi.mock('@/components/BCWidgetCard/BCWidgetCard', () => ({
  __esModule: true,
  default: ({ component, color, icon, title, content }) => (
    <div
      data-test="bc-widget-card"
      data-component={component}
      data-color={color}
      data-icon={icon}
    >
      <div data-test="widget-title">{title}</div>
      <div data-test="widget-content">{content}</div>
    </div>
  )
}))

vi.mock('@/components/BCTypography', () => ({
  __esModule: true,
  default: ({ variant, component, color, sx, children }) => (
    <span
      data-test="bc-typography"
      data-variant={variant}
      data-component={component}
      data-color={color}
      style={sx}
    >
      {children}
    </span>
  )
}))

vi.mock('@mui/material/List', () => ({
  default: ({ component, sx, children }) => (
    <div data-test="mui-list" data-component={component} style={sx}>
      {children}
    </div>
  )
}))
vi.mock('@mui/material/ListItemButton', () => ({
  default: ({ component, alignItems, onClick, children }) => (
    <button
      data-test="mui-list-item-button"
      data-component={component}
      data-align-items={alignItems}
      onClick={onClick}
    >
      {children}
    </button>
  )
}))

// Import after mocks are set up
import AdminLinksCard from '../AdminLinksCard'

describe('AdminLinksCard Component', () => {
  const mockNavigate = vi.fn()
  const mockT = vi.fn((key) => {
    const translations = {
      'dashboard:adminLinks.administration': 'Administration',
      'dashboard:adminLinks.mngGovUsrsLabel': 'Manage Government Users',
      'dashboard:adminLinks.addEditOrgsLabel': 'Add/Edit Organizations',
      'dashboard:adminLinks.usrActivity': 'User Activity',
      'dashboard:adminLinks.loginScreenBackground': 'Login Screen Background'
    }
    return translations[key] || key
  })

  beforeEach(() => {
    vi.resetAllMocks()
    useNavigate.mockReturnValue(mockNavigate)
    useTranslation.mockReturnValue({ t: mockT })
    // Default: user has both Administrator and System Admin roles so all
    // admin links (including the System Admin-only login background) show.
    mockHasRoles.mockImplementation(
      (role) => role === roles.administrator || role === roles.system_admin
    )
  })

  test('renders the component with correct structure', ({ render, query }) => {
    render(<AdminLinksCard />, [query])

    expect(screen.getByTestId('bc-widget-card')).toBeInTheDocument()
    expect(screen.getByTestId('widget-title')).toHaveTextContent(
      'Administration'
    )
    expect(screen.getByTestId('mui-list')).toBeInTheDocument()
  })

  test('renders all admin links correctly', ({ render, query }) => {
    render(<AdminLinksCard />, [query])

    // Check all four admin links are rendered
    expect(screen.getByText('Manage Government Users')).toBeInTheDocument()
    expect(screen.getByText('Add/Edit Organizations')).toBeInTheDocument()
    expect(screen.getByText('User Activity')).toBeInTheDocument()
    expect(screen.getByText('Login Screen Background')).toBeInTheDocument()

    // Check correct number of list item buttons
    const listItemButtons = screen.getAllByTestId('mui-list-item-button')
    expect(listItemButtons).toHaveLength(4)
  })

  test('uses correct translation keys', ({ render, query }) => {
    render(<AdminLinksCard />, [query])

    expect(mockT).toHaveBeenCalledWith('dashboard:adminLinks.administration')
    expect(mockT).toHaveBeenCalledWith('dashboard:adminLinks.mngGovUsrsLabel')
    expect(mockT).toHaveBeenCalledWith('dashboard:adminLinks.addEditOrgsLabel')
    expect(mockT).toHaveBeenCalledWith('dashboard:adminLinks.usrActivity')
    expect(mockT).toHaveBeenCalledWith(
      'dashboard:adminLinks.loginScreenBackground'
    )
  })

  test('navigates to admin users list when first link is clicked', ({
    render,
    query
  }) => {
    render(<AdminLinksCard />, [query])

    const manageUsersButton = screen
      .getByText('Manage Government Users')
      .closest('button')
    fireEvent.click(manageUsersButton)

    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.ADMIN.USERS.LIST)
  })

  test('navigates to organizations list when second link is clicked', ({
    render,
    query
  }) => {
    render(<AdminLinksCard />, [query])

    const organizationsButton = screen
      .getByText('Add/Edit Organizations')
      .closest('button')
    fireEvent.click(organizationsButton)

    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.ORGANIZATIONS.LIST)
  })

  test('navigates to user activity when third link is clicked', ({
    render,
    query
  }) => {
    render(<AdminLinksCard />, [query])

    const userActivityButton = screen
      .getByText('User Activity')
      .closest('button')
    fireEvent.click(userActivityButton)

    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.ADMIN.USER_ACTIVITY)
  })

  test('renders BCWidgetCard with correct props', ({ render, query }) => {
    render(<AdminLinksCard />, [query])

    const widgetCard = screen.getByTestId('bc-widget-card')
    expect(widgetCard).toHaveAttribute('data-component', 'div')
    expect(widgetCard).toHaveAttribute('data-color', 'nav')
    expect(widgetCard).toHaveAttribute('data-icon', 'admin')
  })

  test('renders List component with correct props', ({ render, query }) => {
    render(<AdminLinksCard />, [query])

    const list = screen.getByTestId('mui-list')
    expect(list).toHaveAttribute('data-component', 'div')
    expect(list).toHaveStyle({ maxWidth: '100%' })
  })

  test('renders ListItemButton components with correct props', ({
    render,
    query
  }) => {
    render(<AdminLinksCard />, [query])

    const listItemButtons = screen.getAllByTestId('mui-list-item-button')

    listItemButtons.forEach((button) => {
      expect(button).toHaveAttribute('data-component', 'a')
      expect(button).toHaveAttribute('data-align-items', 'flex-start')
    })
  })

  test('renders BCTypography components with correct props', ({
    render,
    query
  }) => {
    render(<AdminLinksCard />, [query])

    const typographyElements = screen.getAllByTestId('bc-typography')

    typographyElements.forEach((element) => {
      expect(element).toHaveAttribute('data-variant', 'subtitle2')
      expect(element).toHaveAttribute('data-component', 'p')
      expect(element).toHaveAttribute('data-color', 'link')
    })
  })

  test('applies withRole HOC during component initialization', ({
    render,
    query
  }) => {
    render(<AdminLinksCard />, [query])

    // Component should render successfully, indicating withRole mock worked
    expect(screen.getByTestId('bc-widget-card')).toBeInTheDocument()
  })

  test('creates adminLinks array with useMemo hook', ({ render, query }) => {
    render(<AdminLinksCard />, [query])

    // Verify that all expected links are present by checking navigation calls
    const buttons = screen.getAllByTestId('mui-list-item-button')

    // Click each button to verify the routes are set up correctly
    fireEvent.click(buttons[0])
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.ADMIN.USERS.LIST)

    fireEvent.click(buttons[1])
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.ORGANIZATIONS.LIST)

    fireEvent.click(buttons[2])
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.ADMIN.USER_ACTIVITY)

    fireEvent.click(buttons[3])
    expect(mockNavigate).toHaveBeenCalledWith(
      ROUTES.ADMIN.LOGIN_SCREEN_BACKGROUND
    )
  })

  test('uses useTranslation hook with correct namespace', ({
    render,
    query
  }) => {
    render(<AdminLinksCard />, [query])

    expect(useTranslation).toHaveBeenCalledWith(['dashboard'])
  })

  test('memoizes adminLinks based on translation function', ({
    render,
    query
  }) => {
    const { rerender } = render(<AdminLinksCard />, [query])

    // Reset mock to track calls from rerender
    mockT.mockClear()

    // Rerender with same translation function
    rerender(<AdminLinksCard />)

    // Translation should be called again since component re-rendered
    expect(mockT).toHaveBeenCalled()
  })

  describe('Role-based link visibility', () => {
    test('hides the login screen background link from administrators without system admin', ({
      render,
      query
    }) => {
      mockHasRoles.mockImplementation((role) => role === roles.administrator)

      render(<AdminLinksCard />, [query])

      expect(screen.getByText('Manage Government Users')).toBeInTheDocument()
      expect(screen.getByText('Add/Edit Organizations')).toBeInTheDocument()
      expect(screen.getByText('User Activity')).toBeInTheDocument()
      expect(
        screen.queryByText('Login Screen Background')
      ).not.toBeInTheDocument()

      const listItemButtons = screen.getAllByTestId('mui-list-item-button')
      expect(listItemButtons).toHaveLength(3)
    })

    test('shows only the login screen background link for system admins', ({
      render,
      query
    }) => {
      mockHasRoles.mockImplementation((role) => role === roles.system_admin)

      render(<AdminLinksCard />, [query])

      expect(
        screen.queryByText('Manage Government Users')
      ).not.toBeInTheDocument()
      expect(
        screen.queryByText('Add/Edit Organizations')
      ).not.toBeInTheDocument()
      expect(screen.queryByText('User Activity')).not.toBeInTheDocument()
      expect(screen.getByText('Login Screen Background')).toBeInTheDocument()

      const listItemButtons = screen.getAllByTestId('mui-list-item-button')
      expect(listItemButtons).toHaveLength(1)
    })

    test('renders nothing for government users without admin privileges', ({
      render,
      query
    }) => {
      mockHasRoles.mockReturnValue(false)

      const { container } = render(<AdminLinksCard />, [query])

      expect(container).toBeEmptyDOMElement()
    })
  })
})
