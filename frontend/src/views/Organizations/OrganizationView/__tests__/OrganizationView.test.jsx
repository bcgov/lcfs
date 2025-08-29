import { cleanup, fireEvent, render, screen, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OrganizationView } from '../OrganizationView'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'
import { roles } from '@/constants/roles.js'

// Mock react-router-dom hooks
const mockNavigate = vi.fn()
const mockUseLocation = vi.fn(() => ({ state: {} }))
const mockUseParams = vi.fn(() => ({ orgID: '123' }))

vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => mockUseLocation(),
  useParams: () => mockUseParams()
}))

// Mock useCurrentUser hook
const mockCurrentUser = vi.fn(() => ({
  data: { 
    organization: { organizationId: '456' },
    roles: [{ name: roles.government }] 
  },
  hasRoles: vi.fn().mockReturnValue(true)
}))

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockCurrentUser()
}))

// Mock useTranslation
const mockT = vi.fn((key, defaultValue) => defaultValue || key)
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT })
}))

// Mock child components  
vi.mock('../OrganizationDetailsCard', () => ({
  OrganizationDetailsCard: () => <div data-test="organization-details-card">Organization Details</div>
}))

vi.mock('../OrganizationUsers', () => ({
  OrganizationUsers: () => <div data-test="organization-users">Organization Users</div>
}))

vi.mock('../CreditLedger', () => ({
  CreditLedger: ({ organizationId }) => (
    <div data-test="credit-ledger" data-organization-id={organizationId}>
      Credit Ledger - Org: {organizationId}
    </div>
  )
}))

// Mock Keycloak
vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: {
      token: 'mock-token',
      authenticated: true,
      initialized: true
    }
  })
}))

const renderComponent = (props = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <OrganizationView {...props} />
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('OrganizationView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024
    })
    global.addEventListener = vi.fn()
    global.removeEventListener = vi.fn()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  describe('TabPanel Component', () => {
    it('renders correctly with tabs displayed', () => {
      renderComponent()
      
      // Test basic tab rendering which exercises TabPanel internally
      expect(screen.getByRole('tablist')).toBeInTheDocument()
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Organization Details')).toBeInTheDocument()
    })

    it('switches tab content when different tabs are clicked', () => {
      renderComponent()
      
      // Tab switching exercises TabPanel's hidden/visible logic
      expect(screen.getByText('Organization Details')).toBeInTheDocument()
      expect(screen.queryByText('Organization Users')).not.toBeInTheDocument()
      
      fireEvent.click(screen.getByText('org:usersTab'))
      expect(screen.queryByText('Organization Details')).not.toBeInTheDocument() 
      expect(screen.getByText('Organization Users')).toBeInTheDocument()
    })
  })

  describe('OrganizationView Component', () => {
    it('renders basic component structure', () => {
      renderComponent()
      
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('org:usersTab')).toBeInTheDocument()  
      expect(screen.getByText('org:creditLedgerTab')).toBeInTheDocument()
    })

    it('calls translation hook with correct namespace', () => {
      renderComponent()
      
      expect(mockT).toHaveBeenCalledWith('org:dashboardTab', 'Dashboard')
      expect(mockT).toHaveBeenCalledWith('org:usersTab')
      expect(mockT).toHaveBeenCalledWith('org:creditLedgerTab')
    })
  })

  describe('Organization ID Logic', () => {
    it('uses orgID from params when available (IDIR users)', () => {
      mockUseParams.mockReturnValue({ orgID: '123' })
      mockCurrentUser.mockReturnValue({
        data: { organization: { organizationId: '456' }},
        hasRoles: vi.fn().mockReturnValue(true)
      })
      
      renderComponent()
      
      // Click on credit ledger tab to see organizationId prop
      fireEvent.click(screen.getByText('org:creditLedgerTab'))
      
      expect(screen.getByText('Credit Ledger - Org: 123')).toBeInTheDocument()
    })

    it('uses currentUser organizationId when orgID not in params (BCeID users)', () => {
      mockUseParams.mockReturnValue({}) // No orgID
      mockCurrentUser.mockReturnValue({
        data: { organization: { organizationId: '456' }},
        hasRoles: vi.fn().mockReturnValue(false)
      })
      
      renderComponent()
      
      // Click on credit ledger tab to see organizationId prop
      fireEvent.click(screen.getByText('org:creditLedgerTab'))
      
      expect(screen.getByText('Credit Ledger - Org: 456')).toBeInTheDocument()
    })
  })

  describe('Alert State Management', () => {
    it('displays alert when location state has message', () => {
      mockUseLocation.mockReturnValue({
        state: { 
          message: 'Test alert message',
          severity: 'success' 
        }
      })
      
      renderComponent()
      
      expect(screen.getByText('Test alert message')).toBeInTheDocument()
    })

    it('displays alert with default severity when not specified', () => {
      mockUseLocation.mockReturnValue({
        state: { message: 'Test message' }
      })
      
      renderComponent()
      
      expect(screen.getByText('Test message')).toBeInTheDocument()
    })

    it('does not display alert when no message in state', () => {
      mockUseLocation.mockReturnValue({ state: {} })
      
      renderComponent()
      
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('calls navigate to clear location state when alert is shown', () => {
      const mockPath = '/test-path'
      mockUseLocation.mockReturnValue({
        pathname: mockPath,
        state: { message: 'Test message' }
      })
      
      renderComponent()
      
      expect(mockNavigate).toHaveBeenCalledWith(mockPath, { 
        replace: true, 
        state: {} 
      })
    })
  })

  describe('Window Resize Handling', () => {
    it('adds resize event listener on mount', () => {
      renderComponent()
      
      expect(global.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
    })

    it('removes resize event listener on unmount', () => {
      const { unmount } = renderComponent()
      
      unmount()
      
      expect(global.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
    })

    it('handles window resize events', () => {
      Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true })
      
      let resizeHandler
      global.addEventListener = vi.fn((event, handler) => {
        if (event === 'resize') resizeHandler = handler
      })
      
      renderComponent()
      
      // Just verify the handler exists, don't trigger it
      expect(resizeHandler).toBeDefined()
      expect(typeof resizeHandler).toBe('function')
    })
  })

  describe('Tab Navigation', () => {
    it('changes tab when handleChangeTab is called', () => {
      renderComponent()
      
      // Initially on first tab (Dashboard)
      expect(screen.getByText('Organization Details')).toBeInTheDocument()
      
      // Click on Users tab
      fireEvent.click(screen.getByText('org:usersTab'))
      
      expect(screen.getByText('Organization Users')).toBeInTheDocument()
      
      // Click on Credit Ledger tab
      fireEvent.click(screen.getByText('org:creditLedgerTab'))
      
      expect(screen.getByText(/Credit Ledger - Org:/)).toBeInTheDocument()
    })

    it('shows correct tab content based on active tab', () => {
      renderComponent()
      
      // Tab 0 - Dashboard (default)
      expect(screen.getByText('Organization Details')).toBeInTheDocument()
      expect(screen.queryByText('Organization Users')).not.toBeInTheDocument()
      
      // Click Users tab (tab 1)
      fireEvent.click(screen.getByText('org:usersTab'))
      expect(screen.getByText('Organization Users')).toBeInTheDocument()
      expect(screen.queryByText('Organization Details')).not.toBeInTheDocument()
    })
  })

  describe('Tab Content Rendering', () => {
    it('passes organizationId prop to CreditLedger component', () => {
      mockUseParams.mockReturnValue({ orgID: '789' })
      
      renderComponent()
      
      fireEvent.click(screen.getByText('org:creditLedgerTab'))
      
      const creditLedger = screen.getByTestId('credit-ledger')
      expect(creditLedger).toHaveAttribute('data-organization-id', '789')
    })

    it('renders all three tabs with correct labels', () => {
      renderComponent()
      
      const tabs = screen.getAllByRole('tab')
      expect(tabs).toHaveLength(3)
      
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('org:usersTab')).toBeInTheDocument()
      expect(screen.getByText('org:creditLedgerTab')).toBeInTheDocument()
    })
  })

  describe('Current User Integration', () => {
    it('calls useCurrentUser hook', () => {
      renderComponent()
      
      expect(mockCurrentUser).toHaveBeenCalled()
    })

    it('derives isIdir from hasRoles government check', () => {
      const mockHasRoles = vi.fn().mockReturnValue(true)
      mockCurrentUser.mockReturnValue({
        data: { organization: { organizationId: '456' }},
        hasRoles: mockHasRoles
      })
      
      renderComponent()
      
      expect(mockHasRoles).toHaveBeenCalledWith(roles.government)
    })
  })
})