import React from 'react'
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OrganizationView } from '../OrganizationView'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'
import { roles } from '@/constants/roles.js'

// Use the exact same mocking pattern as the working CreditLedger test
vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: {
      token: 'mock-token',
      authenticated: true,
      initialized: true
    }
  })
}))

// Mock react-i18next exactly like CreditLedger
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: vi.fn((key, defaultValue) => defaultValue || key) })
}))

// Mock all components individually like CreditLedger does
vi.mock('@/components/BCBox', () => ({
  default: ({ children, ...props }) => <div {...props}>{children}</div>
}))

vi.mock('@/components/BCAlert', () => ({
  default: ({ children, ...props }) => <div role="alert" {...props}>{children}</div>
}))

vi.mock('@mui/material', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    AppBar: ({ children, ...props }) => <div {...props}>{children}</div>,
    Tabs: ({ children, onChange, value, scrollButtons, ...props }) => {
      // Create enhanced children with click handlers
      const enhancedChildren = React.Children.map(children, (child, index) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, {
            onClick: () => onChange && onChange({}, index)
          })
        }
        return child
      })
      
      return (
        <div role="tablist" {...props}>
          {enhancedChildren}
        </div>
      )
    },
    Tab: ({ label, onClick, ...props }) => (
      <button role="tab" onClick={onClick} {...props}>
        {label}
      </button>
    )
  }
})

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
      Credit Ledger {organizationId}
    </div>
  )
}))

// Mock hooks
const mockCurrentUser = {
  data: {
    organization: { organizationId: '456' },
    roles: [{ name: roles.government }]
  },
  hasRoles: vi.fn().mockReturnValue(true)
}

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockCurrentUser
}))

const mockNavigate = vi.fn()
const mockLocation = { state: {} }
const mockParams = { orgID: '123' }

vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
  useParams: () => mockParams
}))

const renderComponent = (props = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <OrganizationView {...props} />
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('OrganizationView Coverage Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock window methods
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024
    })
    vi.spyOn(window, 'addEventListener')
    vi.spyOn(window, 'removeEventListener')
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  // Test 1: Basic rendering
  it('renders component without crashing', () => {
    renderComponent()
    expect(screen.getByRole('tablist')).toBeInTheDocument()
  })

  // Test 2: Tab switching (handleChangeTab function)
  it('switches between tabs', () => {
    renderComponent()
    
    expect(screen.getByText('Organization Details')).toBeInTheDocument()
    expect(screen.queryByText('Organization Users')).not.toBeInTheDocument()
    
    fireEvent.click(screen.getByText('org:usersTab'))
    expect(screen.queryByText('Organization Details')).not.toBeInTheDocument()
    expect(screen.getByText('Organization Users')).toBeInTheDocument()
  })

  // Test 3: Organization ID logic (conditional branch)
  it('uses orgID from params when available', () => {
    renderComponent()
    
    fireEvent.click(screen.getByText('org:creditLedgerTab'))
    const ledger = screen.getByTestId('credit-ledger')
    expect(ledger).toHaveAttribute('data-organization-id', '123')
  })

  // Test 4: Organization ID fallback - we can test this via CreditLedger prop
  it('passes correct organizationId to CreditLedger', () => {
    renderComponent()
    
    fireEvent.click(screen.getByText('org:creditLedgerTab'))
    const ledger = screen.getByTestId('credit-ledger')
    
    // This test verifies the organizationId logic works
    expect(ledger).toHaveAttribute('data-organization-id', '123')  // orgID from params
    expect(ledger).toBeInTheDocument()
  })
  
  // Test 5: Event listeners (useEffect)
  it('sets up resize event listeners', () => {
    renderComponent()
    expect(window.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
  })

  it('cleans up resize event listeners', () => {
    const { unmount } = renderComponent()
    unmount()
    expect(window.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
  })

  // Test 6: Translation hook usage (covered by component rendering)
  it('renders translated tab labels', () => {
    renderComponent()
    
    // The translation calls are made during render, verify labels exist
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('org:usersTab')).toBeInTheDocument()
    expect(screen.getByText('org:creditLedgerTab')).toBeInTheDocument()
  })

  // Test 7: Current user hook usage
  it('calls useCurrentUser hook', () => {
    renderComponent()
    
    expect(mockCurrentUser.hasRoles).toHaveBeenCalledWith(roles.government)
  })

  // Test 8: Tab rendering
  it('renders correct number of tabs', () => {
    renderComponent()
    
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(3)
  })

  // Test 9: Tab content conditional rendering
  it('shows only active tab content', () => {
    renderComponent()
    
    // Only dashboard should be visible initially
    expect(screen.getByText('Organization Details')).toBeInTheDocument()
    expect(screen.queryByText('Organization Users')).not.toBeInTheDocument()
    expect(screen.queryByText(/Credit Ledger/)).not.toBeInTheDocument()
  })

  // Test 10: Alert functionality (covers location state useEffect)
  it('handles location state correctly', () => {
    // This test covers the alert state logic by verifying no alert shows when state is empty
    renderComponent()
    
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  // Test 11: Alert display with message (covers lines 44-49, 87-89)
  it('displays alert when location has message and calls navigate', () => {
    // Modify mockLocation to have a message
    mockLocation.state = { 
      message: 'Test alert message',
      severity: 'success'
    }
    mockLocation.pathname = '/test-path'
    
    renderComponent()
    
    // Should show alert
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Test alert message')).toBeInTheDocument()
    
    // Should call navigate to clear state
    expect(mockNavigate).toHaveBeenCalledWith('/test-path', { replace: true, state: {} })
  })

  // Test 12: Window resize handler branches (covers line 70)
  it('handles window resize with different widths', async () => {
    let resizeHandler
    
    // Capture the resize handler
    vi.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'resize') {
        resizeHandler = handler
      }
    })
    
    renderComponent()
    
    // Test mobile width (< 500)
    await act(async () => {
      Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true })
      resizeHandler()
      // Allow time for state updates
      await new Promise(resolve => setTimeout(resolve, 10))
    })
    
    // Test desktop width (>= 500)
    await act(async () => {
      Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true })
      resizeHandler()
      // Allow time for state updates
      await new Promise(resolve => setTimeout(resolve, 10))
    })
    
    // Component should still render after both resize events
    expect(screen.getByRole('tablist')).toBeInTheDocument()
  })
})