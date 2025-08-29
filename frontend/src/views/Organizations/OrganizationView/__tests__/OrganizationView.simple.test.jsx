import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OrganizationView } from '../OrganizationView'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'
import { roles } from '@/constants/roles.js'

// Minimal mocking strategy
const mockNavigate = vi.fn()
const mockUseLocation = vi.fn(() => ({ state: {} }))
const mockUseParams = vi.fn(() => ({ orgID: '123' }))
const mockUseCurrentUser = vi.fn(() => ({
  data: { organization: { organizationId: '456' }},
  hasRoles: vi.fn().mockReturnValue(true)
}))
const mockT = vi.fn((key, defaultValue) => defaultValue || key)

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockUseLocation(),
  useParams: () => mockUseParams()
}))

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockUseCurrentUser()
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT })
}))

vi.mock('../OrganizationDetailsCard', () => ({
  OrganizationDetailsCard: () => <div>Details Card</div>
}))

vi.mock('../OrganizationUsers', () => ({
  OrganizationUsers: () => <div>Users</div>
}))

vi.mock('../CreditLedger', () => ({
  CreditLedger: ({ organizationId }) => <div>Credit Ledger {organizationId}</div>
}))

const renderComponent = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <OrganizationView />
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('OrganizationView Simple Coverage Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'innerWidth', { value: 1024 })
    global.addEventListener = vi.fn()
    global.removeEventListener = vi.fn()
  })

  afterEach(() => {
    cleanup()
  })

  // Basic rendering - covers main component function
  it('renders without crashing', () => {
    renderComponent()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  // Tab functionality - covers handleChangeTab function
  it('switches between tabs', () => {
    renderComponent()
    
    expect(screen.getByText('Details Card')).toBeInTheDocument()
    
    fireEvent.click(screen.getByText('org:usersTab'))
    expect(screen.getByText('Users')).toBeInTheDocument()
    
    fireEvent.click(screen.getByText('org:creditLedgerTab')) 
    expect(screen.getByText('Credit Ledger 123')).toBeInTheDocument()
  })

  // Organization ID logic - covers conditional branches
  it('uses orgID from params', () => {
    mockUseParams.mockReturnValue({ orgID: '789' })
    renderComponent()
    
    fireEvent.click(screen.getByText('org:creditLedgerTab'))
    expect(screen.getByText('Credit Ledger 789')).toBeInTheDocument()
  })

  // Fallback organization ID - covers nullish coalescing branch
  it('uses currentUser organizationId when no orgID in params', () => {
    mockUseParams.mockReturnValue({})
    mockUseCurrentUser.mockReturnValue({
      data: { organization: { organizationId: '999' }},
      hasRoles: vi.fn().mockReturnValue(false)
    })
    
    renderComponent()
    
    fireEvent.click(screen.getByText('org:creditLedgerTab'))
    expect(screen.getByText('Credit Ledger 999')).toBeInTheDocument()
  })

  // Alert state - covers conditional rendering branches
  it('shows alert when location has message', () => {
    mockUseLocation.mockReturnValue({
      state: { message: 'Test Alert' },
      pathname: '/test'
    })
    
    renderComponent()
    
    expect(screen.getByText('Test Alert')).toBeInTheDocument()
    expect(mockNavigate).toHaveBeenCalledWith('/test', { replace: true, state: {} })
  })

  it('shows alert with custom severity', () => {
    mockUseLocation.mockReturnValue({
      state: { message: 'Error Message', severity: 'error' },
      pathname: '/test'
    })
    
    renderComponent()
    
    expect(screen.getByText('Error Message')).toBeInTheDocument()
  })

  it('does not show alert when no message', () => {
    mockUseLocation.mockReturnValue({ state: {} })
    renderComponent()
    
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  // Event listeners - covers useEffect hook
  it('adds resize event listener', () => {
    renderComponent()
    expect(global.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
  })

  it('removes resize event listener on unmount', () => {
    const { unmount } = renderComponent()
    unmount()
    expect(global.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
  })

  // Current user integration - covers hook usage
  it('calls useCurrentUser hook', () => {
    renderComponent()
    expect(mockUseCurrentUser).toHaveBeenCalled()
  })

  it('calls hasRoles with government role', () => {
    const mockHasRoles = vi.fn().mockReturnValue(true)
    mockUseCurrentUser.mockReturnValue({
      data: { organization: { organizationId: '456' }},
      hasRoles: mockHasRoles
    })
    
    renderComponent()
    expect(mockHasRoles).toHaveBeenCalledWith(roles.government)
  })

  // Translation integration - covers useTranslation hook
  it('uses translation for tab labels', () => {
    renderComponent()
    
    expect(mockT).toHaveBeenCalledWith('org:dashboardTab', 'Dashboard')
    expect(mockT).toHaveBeenCalledWith('org:usersTab')
    expect(mockT).toHaveBeenCalledWith('org:creditLedgerTab')
  })

  // Tab rendering - covers map function and JSX branches
  it('renders all three tabs', () => {
    renderComponent()
    
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(3)
  })

  // TabPanel logic - covers conditional rendering in TabPanel
  it('shows only active tab content', () => {
    renderComponent()
    
    // Initially shows dashboard
    expect(screen.getByText('Details Card')).toBeInTheDocument()
    expect(screen.queryByText('Users')).not.toBeInTheDocument()
    
    // Switch to users tab
    fireEvent.click(screen.getByText('org:usersTab'))
    expect(screen.queryByText('Details Card')).not.toBeInTheDocument()
    expect(screen.getByText('Users')).toBeInTheDocument()
  })

  // Window resize - covers resize handler branches
  it('handles window resize events', () => {
    Object.defineProperty(window, 'innerWidth', { value: 400 })
    
    let resizeHandler
    global.addEventListener = vi.fn((event, handler) => {
      if (event === 'resize') {
        resizeHandler = handler
      }
    })
    
    renderComponent()
    
    // Verify handler was set up
    expect(resizeHandler).toBeDefined()
    expect(typeof resizeHandler).toBe('function')
    
    // Call the handler to test resize logic branches
    resizeHandler()
    
    // Component should still render after resize
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })
})