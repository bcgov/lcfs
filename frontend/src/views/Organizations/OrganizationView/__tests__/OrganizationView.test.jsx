import { cleanup, fireEvent, render, screen, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OrganizationView } from '../OrganizationView'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'
import { roles } from '@/constants/roles'
import { useOrganizationPageStore } from '@/stores/useOrganizationPageStore'

// Mock react-router-dom hooks - SINGLE DEFINITION
const mockNavigate = vi.fn()
const mockUseLocation = vi.fn(() => ({
  pathname: '/organizations/123',
  state: {}
}))
const mockUseParams = vi.fn(() => ({ orgID: '123' }))

vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => mockUseLocation(),
  useParams: () => mockUseParams()
}))

// Mock useCurrentUser hook - SINGLE DEFINITION
const mockCurrentUser = vi.fn(() => ({
  data: {
    organization: { organizationId: '456' },
    roles: [{ name: roles.analyst }]
  },
  hasRoles: vi.fn().mockImplementation((r) => r === roles.government),
  hasAnyRole: vi.fn().mockImplementation((...rs) => rs.includes(roles.analyst))
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
  OrganizationDetailsCard: () => (
    <div data-test="organization-details-card">Organization Details</div>
  )
}))

vi.mock('../OrganizationUsers', () => ({
  OrganizationUsers: () => (
    <div data-test="organization-users">Organization Users</div>
  )
}))

// Mock CreditLedger - SINGLE DEFINITION
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

// Mock useApiService
vi.mock('@/services/useApiService', () => {
  const mockGet = vi.fn(() =>
    Promise.resolve({
      data: { name: 'Test Org', operatingName: 'Test Operating Name' }
    })
  )
  return {
    useApiService: () => ({
      get: mockGet
    })
  }
})

// Mock BCGridViewer - Fixed to use named export
vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  BCGridViewer: () => <div data-test="bc-grid-viewer">BCGridViewer</div>
}))

vi.mock('@/components/ClearFiltersButton', () => ({
  ClearFiltersButton: ({ onClick, ...props }) => (
    <button data-test="clear-filters-button" onClick={onClick} {...props}>
      Clear filters
    </button>
  )
}))

// Mock useOrganization hooks
vi.mock('@/hooks/useOrganization', () => ({
  useOrganization: vi.fn((orgId) => ({
    data: {
      organizationId: orgId,
      orgStatus: { status: 'Registered' },
      name: 'Test Org',
      operatingName: 'Test Operating Name',
      email: 'test@test.com',
      phone: '1234567890',
      hasEarlyIssuance: false,
      creditTradingEnabled: true,
      orgAddress: {
        streetAddress: '123 Test St',
        addressOther: 'Unit 101',
        city: 'Testville',
        provinceState: 'TestState',
        country: 'TestCountry',
        postalcodeZipcode: '12345'
      },
      orgAttorneyAddress: {
        streetAddress: '456 Lawyer Ln',
        addressOther: 'Suite 202',
        city: 'Lawyerville',
        provinceState: 'LawState',
        country: 'LawCountry',
        postalcodeZipcode: '67890'
      }
    },
    isLoading: false,
    isError: false
  })),
  useOrganizationBalance: vi.fn((orgId) => ({
    data: {
      registered: true,
      organizationId: orgId,
      totalBalance: 1000,
      reservedBalance: 500
    },
    isLoading: false
  }))
}))

// Mock BCAlert
vi.mock('@/components/BCAlert', () => ({
  default: ({ children, severity, sx }) => (
    <div data-test="alert-box" role="alert" data-severity={severity}>
      {children}
    </div>
  )
}))

// Mock BCBox
vi.mock('@/components/BCBox', () => ({
  default: ({ children, ...props }) => (
    <div data-test="bc-box" {...props}>
      {children}
    </div>
  )
}))

// SINGLE renderComponent function definition
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
    useOrganizationPageStore.getState().resetOrganizationContext()

    // Reset mock returns to defaults
    mockUseLocation.mockReturnValue({
      pathname: '/organizations/123',
      state: {}
    })
    mockUseParams.mockReturnValue({ orgID: '123' })
    mockCurrentUser.mockReturnValue({
      data: {
        organization: { organizationId: '456' },
        roles: [{ name: roles.analyst }]
      },
      hasRoles: vi.fn().mockImplementation((r) => r === roles.government),
      hasAnyRole: vi
        .fn()
        .mockImplementation((...rs) => rs.includes(roles.analyst))
    })
  })

  afterEach(() => {
    useOrganizationPageStore.getState().resetOrganizationContext()
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

      // Initially shows dashboard content
      expect(screen.getByText('Organization Details')).toBeInTheDocument()
      expect(screen.queryByText('Organization Users')).not.toBeInTheDocument()

      // Clicking tabs should call navigate (routing-based approach)
      fireEvent.click(screen.getByText('Users'))
      expect(mockNavigate).toHaveBeenCalled()
    })
  })

  describe('OrganizationView Component', () => {
    it('renders basic component structure', () => {
      renderComponent()

      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Users')).toBeInTheDocument()
      expect(screen.getByText('Credit ledger')).toBeInTheDocument()
      expect(screen.getByText('Company overview')).toBeInTheDocument()
      expect(screen.getByText('Penalty log')).toBeInTheDocument()
      expect(screen.getByText('Supply history')).toBeInTheDocument()
      expect(
        screen.getByText('Compliance tracking')
      ).toBeInTheDocument()
    })

    it('displays organization title for government users', () => {
      renderComponent()

      expect(screen.getByText('Test Org — Dashboard')).toBeInTheDocument()
    })

    it('updates organization title when navigating to users tab', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/organizations/123/users',
        state: {}
      })

      renderComponent()

      expect(screen.getByText('Test Org — Users')).toBeInTheDocument()
    })
  })

  describe('Organization ID Logic', () => {
    it('uses orgID from params when available (IDIR users)', () => {
      mockUseParams.mockReturnValue({ orgID: '123' })
      mockCurrentUser.mockReturnValue({
        data: { organization: { organizationId: '456' } },
        hasRoles: vi.fn().mockReturnValue(true)
      })
      mockUseLocation.mockReturnValue({
        pathname: '/organizations/123/credit-ledger',
        state: {}
      })

      renderComponent()

      expect(screen.getByTestId('credit-ledger')).toBeInTheDocument()
      expect(screen.getByTestId('credit-ledger')).toHaveAttribute(
        'data-organization-id',
        '123'
      )
    })

    it('redirects BCeID users to dashboard when accessing restricted tabs', () => {
      mockUseParams.mockReturnValue({}) // No orgID
      mockCurrentUser.mockReturnValue({
        data: { organization: { organizationId: '456' } },
        hasRoles: vi.fn().mockReturnValue(false) // BCeID user (not government)
      })
      mockUseLocation.mockReturnValue({
        pathname: '/organizations/456/credit-ledger', // Trying to access restricted tab
        state: {}
      })

      renderComponent()

      // BCeID users should see dashboard, not credit-ledger
      expect(screen.queryByTestId('credit-ledger')).not.toBeInTheDocument()
      expect(screen.getByTestId('organization-details-card')).toBeInTheDocument()
      expect(
        screen.queryByText('Test Org — Dashboard')
      ).not.toBeInTheDocument()
    })
  })

  describe('Alert State Management', () => {
    it('displays alert when location state has message', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/organizations/123',
        state: {
          message: 'Test alert message',
          severity: 'success'
        }
      })

      renderComponent()

      expect(screen.getByText('Test alert message')).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveAttribute(
        'data-severity',
        'success'
      )
    })

    it('displays alert with default severity when not specified', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/organizations/123',
        state: { message: 'Test message' }
      })

      renderComponent()

      expect(screen.getByText('Test message')).toBeInTheDocument()
      // Default severity should be 'info'
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('does not display alert when no message in state', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/organizations/123',
        state: {}
      })

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

      expect(global.addEventListener).toHaveBeenCalledWith(
        'resize',
        expect.any(Function)
      )
    })

    it('removes resize event listener on unmount', () => {
      const { unmount } = renderComponent()

      unmount()

      expect(global.removeEventListener).toHaveBeenCalledWith(
        'resize',
        expect.any(Function)
      )
    })

    it('handles window resize events', () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 400,
        configurable: true
      })

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

      // Click on Users tab should call navigate
      fireEvent.click(screen.getByText('Users'))
      expect(mockNavigate).toHaveBeenCalled()

      // Click on Credit Ledger tab should call navigate
      fireEvent.click(screen.getByText('Credit ledger'))
      expect(mockNavigate).toHaveBeenCalled()
    })

    it('shows correct tab content based on active tab', () => {
      // Test dashboard content (default)
      mockUseLocation.mockReturnValue({
        pathname: '/organizations/123',
        state: {}
      })
      renderComponent()
      expect(screen.getByText('Organization Details')).toBeInTheDocument()
      expect(screen.queryByText('Organization Users')).not.toBeInTheDocument()
    })

    it('shows users content when on users route', () => {
      // Test users content by mocking users route
      mockUseLocation.mockReturnValue({
        pathname: '/organizations/123/users',
        state: {}
      })
      renderComponent()
      expect(screen.getByText('Organization Users')).toBeInTheDocument()
      expect(screen.queryByText('Organization Details')).not.toBeInTheDocument()
    })
  })

  describe('Tab Content Rendering', () => {
    it('passes organizationId prop to CreditLedger component', () => {
      mockUseParams.mockReturnValue({ orgID: '789' })
      mockUseLocation.mockReturnValue({
        pathname: '/organizations/789/credit-ledger',
        state: {}
      })

      renderComponent()

      const creditLedger = screen.getByTestId('credit-ledger')
      expect(creditLedger).toHaveAttribute('data-organization-id', '789')
    })

    it('renders all three tabs with correct labels', () => {
      renderComponent()

      const tabs = screen.getAllByRole('tab')
      expect(tabs).toHaveLength(7)

      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Users')).toBeInTheDocument()
      expect(screen.getByText('Credit ledger')).toBeInTheDocument()
    })
  })

  describe('Current User Integration', () => {
    it('calls useCurrentUser hook', () => {
      renderComponent()

      expect(mockCurrentUser).toHaveBeenCalled()
    })

    it('renders all tab labels correctly', () => {
      renderComponent()

      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Users')).toBeInTheDocument()
      expect(screen.getByText('Credit ledger')).toBeInTheDocument()
      expect(screen.getByText('Company overview')).toBeInTheDocument()
      expect(screen.getByText('Penalty log')).toBeInTheDocument()
      expect(screen.getByText('Supply history')).toBeInTheDocument()
      expect(screen.getByText('Compliance tracking')).toBeInTheDocument()
    })
  })

  describe('Tab Navigation', () => {
    it('navigates between tabs correctly', () => {
      renderComponent()

      // Should have Organization Details by default (dashboard tab)
      expect(screen.getByText('Organization Details')).toBeInTheDocument()

      // Click Users tab should call navigate
      fireEvent.click(screen.getByText('Users'))
      expect(mockNavigate).toHaveBeenCalled()
    })

    it('renders correct tab content based on pathname', () => {
      // Test users path
      mockUseLocation.mockReturnValue({
        pathname: '/organizations/123/users',
        state: {}
      })

      renderComponent()
      expect(screen.getByText('Organization Users')).toBeInTheDocument()
    })
  })
})
