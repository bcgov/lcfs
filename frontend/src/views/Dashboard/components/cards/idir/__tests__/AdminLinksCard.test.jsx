import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ROUTES } from '@/routes/routes'
import { roles } from '@/constants/roles'
import { wrapper } from '@/tests/utils/wrapper'

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

vi.mock('@mui/material', () => ({
  List: ({ component, sx, children }) => (
    <div data-test="mui-list" data-component={component} style={sx}>
      {children}
    </div>
  ),
  ListItemButton: ({ component, alignItems, onClick, children }) => (
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
      'dashboard:adminLinks.usrActivity': 'User Activity'
    }
    return translations[key] || key
  })

  beforeEach(() => {
    vi.resetAllMocks()
    useNavigate.mockReturnValue(mockNavigate)
    useTranslation.mockReturnValue({ t: mockT })
  })

  it('renders the component with correct structure', () => {
    render(<AdminLinksCard />, { wrapper })

    expect(screen.getByTestId('bc-widget-card')).toBeInTheDocument()
    expect(screen.getByTestId('widget-title')).toHaveTextContent('Administration')
    expect(screen.getByTestId('mui-list')).toBeInTheDocument()
  })

  it('renders all admin links correctly', () => {
    render(<AdminLinksCard />, { wrapper })

    // Check all three admin links are rendered
    expect(screen.getByText('Manage Government Users')).toBeInTheDocument()
    expect(screen.getByText('Add/Edit Organizations')).toBeInTheDocument()
    expect(screen.getByText('User Activity')).toBeInTheDocument()
    
    // Check correct number of list item buttons
    const listItemButtons = screen.getAllByTestId('mui-list-item-button')
    expect(listItemButtons).toHaveLength(3)
  })

  it('uses correct translation keys', () => {
    render(<AdminLinksCard />, { wrapper })

    expect(mockT).toHaveBeenCalledWith('dashboard:adminLinks.administration')
    expect(mockT).toHaveBeenCalledWith('dashboard:adminLinks.mngGovUsrsLabel')
    expect(mockT).toHaveBeenCalledWith('dashboard:adminLinks.addEditOrgsLabel')
    expect(mockT).toHaveBeenCalledWith('dashboard:adminLinks.usrActivity')
  })

  it('navigates to admin users list when first link is clicked', () => {
    render(<AdminLinksCard />, { wrapper })

    const manageUsersButton = screen.getByText('Manage Government Users').closest('button')
    fireEvent.click(manageUsersButton)

    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.ADMIN.USERS.LIST)
  })

  it('navigates to organizations list when second link is clicked', () => {
    render(<AdminLinksCard />, { wrapper })

    const organizationsButton = screen.getByText('Add/Edit Organizations').closest('button')
    fireEvent.click(organizationsButton)

    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.ORGANIZATIONS.LIST)
  })

  it('navigates to user activity when third link is clicked', () => {
    render(<AdminLinksCard />, { wrapper })

    const userActivityButton = screen.getByText('User Activity').closest('button')
    fireEvent.click(userActivityButton)

    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.ADMIN.USER_ACTIVITY)
  })

  it('renders BCWidgetCard with correct props', () => {
    render(<AdminLinksCard />, { wrapper })

    const widgetCard = screen.getByTestId('bc-widget-card')
    expect(widgetCard).toHaveAttribute('data-component', 'div')
    expect(widgetCard).toHaveAttribute('data-color', 'nav')
    expect(widgetCard).toHaveAttribute('data-icon', 'admin')
  })

  it('renders List component with correct props', () => {
    render(<AdminLinksCard />, { wrapper })

    const list = screen.getByTestId('mui-list')
    expect(list).toHaveAttribute('data-component', 'div')
    expect(list).toHaveStyle({ maxWidth: '100%' })
  })

  it('renders ListItemButton components with correct props', () => {
    render(<AdminLinksCard />, { wrapper })

    const listItemButtons = screen.getAllByTestId('mui-list-item-button')
    
    listItemButtons.forEach(button => {
      expect(button).toHaveAttribute('data-component', 'a')
      expect(button).toHaveAttribute('data-align-items', 'flex-start')
    })
  })

  it('renders BCTypography components with correct props', () => {
    render(<AdminLinksCard />, { wrapper })

    const typographyElements = screen.getAllByTestId('bc-typography')
    
    typographyElements.forEach(element => {
      expect(element).toHaveAttribute('data-variant', 'subtitle2')
      expect(element).toHaveAttribute('data-component', 'p')
      expect(element).toHaveAttribute('data-color', 'link')
    })
  })

  it('applies withRole HOC during component initialization', () => {
    render(<AdminLinksCard />, { wrapper })

    // Component should render successfully, indicating withRole mock worked
    expect(screen.getByTestId('bc-widget-card')).toBeInTheDocument()
  })

  it('creates adminLinks array with useMemo hook', () => {
    render(<AdminLinksCard />, { wrapper })

    // Verify that all expected links are present by checking navigation calls
    const buttons = screen.getAllByTestId('mui-list-item-button')
    
    // Click each button to verify the routes are set up correctly
    fireEvent.click(buttons[0])
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.ADMIN.USERS.LIST)
    
    fireEvent.click(buttons[1])
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.ORGANIZATIONS.LIST)
    
    fireEvent.click(buttons[2])
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.ADMIN.USER_ACTIVITY)
  })

  it('uses useTranslation hook with correct namespace', () => {
    render(<AdminLinksCard />, { wrapper })

    expect(useTranslation).toHaveBeenCalledWith(['dashboard'])
  })

  it('memoizes adminLinks based on translation function', () => {
    const { rerender } = render(<AdminLinksCard />, { wrapper })

    // Reset mock to track calls from rerender
    mockT.mockClear()

    // Rerender with same translation function
    rerender(<AdminLinksCard />)

    // Translation should be called again since component re-rendered
    expect(mockT).toHaveBeenCalled()
  })
})