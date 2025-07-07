import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CreditLedger } from '../CreditLedger'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'

// Mock all the hooks and services
vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: {
      token: 'mock-token',
      authenticated: true,
      initialized: true
    }
  })
}))

vi.mock('@/services/useApiService', () => ({
  useApiService: () => ({
    get: vi.fn(() => Promise.resolve({ data: [] })),
    post: vi.fn(() => Promise.resolve({ data: { ledger: [], pagination: {} } })),
    download: vi.fn()
  })
}))

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { organization: { organizationId: 999 } },
    isLoading: false
  })
}))

vi.mock('@/hooks/useOrganization', () => ({
  useOrganizationBalance: vi.fn((orgId) => ({
    data: { totalBalance: 5000 },
    isLoading: false
  }))
}))

vi.mock('@/hooks/useComplianceReports', () => ({
  useCompliancePeriod: () => ({
    data: [
      { compliance_period_id: 1, description: '2023' },
      { compliance_period_id: 2, description: '2024' }
    ],
    isLoading: false
  })
}))

vi.mock('@/hooks/useCreditLedger', () => ({
  useCreditLedger: vi.fn((params) => ({
    data: {
      ledger: [],
      pagination: { page: 1, size: 10, total: 0, totalPages: 0 }
    },
    isLoading: false
  })),
  useDownloadCreditLedger: () => vi.fn()
}))

vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  BCGridViewer: ({ queryData }) => (
    <div data-testid="credit-ledger-grid">
      Mock Grid with {queryData?.data?.ledger?.length || 0} items
    </div>
  )
}))

const renderComponent = (props = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })
  
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CreditLedger {...props} />
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('CreditLedger Component Tests', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders credit ledger with basic elements', () => {
    renderComponent()
    
    expect(screen.getByText(/Credit ledger/i)).toBeInTheDocument()
    expect(screen.getByText(/Available credit balance/i)).toBeInTheDocument()
    expect(screen.getByText(/Show transactions in/i)).toBeInTheDocument()
    expect(screen.getByText(/All years/i)).toBeInTheDocument()
    expect(screen.getByText(/Mock Grid with/i)).toBeInTheDocument()
  })

  it('renders with organizationId prop correctly', () => {
    renderComponent({ organizationId: 123 })
    
    // Component should render successfully with organizationId prop
    expect(screen.getByText(/Credit ledger/i)).toBeInTheDocument()
    expect(screen.getByText(/Mock Grid with/i)).toBeInTheDocument()
  })

  it('renders when no organizationId prop is provided', () => {
    renderComponent() // No organizationId prop
    
    // Component should render successfully and fallback to current user's org
    expect(screen.getByText(/Credit ledger/i)).toBeInTheDocument()
    expect(screen.getByText(/Mock Grid with/i)).toBeInTheDocument()
  })

  it('displays available balance correctly', () => {
    renderComponent()
    
    // Check that balance is displayed (5000 from mock)
    expect(screen.getByText('5,000')).toBeInTheDocument()
  })

  it('shows year dropdown with compliance periods', () => {
    renderComponent()
    
    // Should show "All years" option and compliance periods
    expect(screen.getByText(/All years/i)).toBeInTheDocument()
    
    // The years should be available in the dropdown (not directly visible until opened)
    // But we can verify the component renders without errors
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })
})