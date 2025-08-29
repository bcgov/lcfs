import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrganizationView } from '../OrganizationView'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'

// Mock everything to make it super simple
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ state: {} }),
  useParams: () => ({ orgID: '123' })
}))

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { organization: { organizationId: '456' }},
    hasRoles: vi.fn()
  })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ 
    t: (key, defaultValue) => defaultValue || key 
  })
}))

vi.mock('../OrganizationDetailsCard', () => ({
  OrganizationDetailsCard: () => <div>Details</div>
}))

vi.mock('../OrganizationUsers', () => ({
  OrganizationUsers: () => <div>Users</div>  
}))

vi.mock('../CreditLedger', () => ({
  CreditLedger: () => <div>Ledger</div>
}))

const renderComponent = () => {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <OrganizationView />
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('OrganizationView Minimal Tests', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders component', () => {
    renderComponent()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('switches tabs', () => {
    renderComponent()
    
    // Test tab switching
    expect(screen.getByText('Details')).toBeInTheDocument()
    
    fireEvent.click(screen.getByText('org:usersTab'))
    expect(screen.getByText('Users')).toBeInTheDocument()
    
    fireEvent.click(screen.getByText('org:creditLedgerTab'))
    expect(screen.getByText('Ledger')).toBeInTheDocument()
  })

  it('renders tabs correctly', () => {
    renderComponent()
    
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(3)
  })

  it('shows tab content conditionally', () => {
    renderComponent()
    
    // Initially shows first tab content
    expect(screen.getByText('Details')).toBeInTheDocument()
    expect(screen.queryByText('Users')).not.toBeInTheDocument()
    
    // Switch tabs and verify content changes
    fireEvent.click(screen.getByText('org:usersTab'))
    expect(screen.queryByText('Details')).not.toBeInTheDocument()
    expect(screen.getByText('Users')).toBeInTheDocument()
  })
})