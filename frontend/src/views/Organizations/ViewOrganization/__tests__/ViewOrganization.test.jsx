import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ViewOrganization } from '../ViewOrganization'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: {
      token: 'mock-token',
      authenticated: true,
      initialized: true
    }
  })
}))

// Mock the specific import of useApiService
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

// Mock necessary hooks and dependencies
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: {
      roles: [{ name: 'Government' }]
    },
    isLoading: false,
    hasRoles: vi.fn().mockReturnValue(true),
    hasAnyRole: vi.fn().mockReturnValue(true)
  })
}))

// Mock the specific import of BCDataGridServer
vi.mock('@/components/BCDataGrid/BCDataGridServer', () => ({
  // Replace BCDataGridServer with a dummy component
  __esModule: true, // This is important for mocking ES modules
  default: () => <div data-test="mockedBCDataGridServer"></div>
}))

// Mock the useOrganization hook
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
      orgAddress: {
        streetAddress: '123 Test St',
        addressOther: 'Unit 101',
        city: 'Testville',
        provinceState: 'TestState',
        country: 'TestCountry',
        postalcodeZipcode: '12345'
      },
      orgAttorneyAddress: {
        // Adding this to simulate a full address structure
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

vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  MemoryRouter: () => vi.fn(),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ state: {} }),
  useParams: () => ({ orgID: '123' })
}))

const renderComponent = (props) => {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <ViewOrganization {...props} />
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('ViewOrganization Component Tests', () => {
  beforeEach(() => {
    renderComponent()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders organization details correctly', () => {
    expect(screen.getByText(/Test Operating Name/i)).toBeInTheDocument()
    expect(screen.getByText(/test@test.com/i)).toBeInTheDocument()
  })

  it('shows correct labels and values for organization data', () => {
    expect(screen.getByText(/Legal name of organization/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Operating name of organization/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/Phone Number/i)).toBeInTheDocument()
    expect(screen.getByText(/Email Address/i)).toBeInTheDocument()
  })

  it('handles role-based elements correctly for government role', () => {
    expect(screen.getByText(/Compliance Unit Balance:/i)).toBeInTheDocument()
    expect(screen.getByText(/1,000/i)).toBeInTheDocument()
    expect(screen.getByText(/500/i)).toBeInTheDocument()
  })

  it('renders the "Registered for transfers" text for a Registered org', () => {
    expect(
      screen.getByText(
        /A registered organization is able to transfer compliance units/i
      )
    ).toBeInTheDocument()
  })

  it('shows "No" for early issuance if hasEarlyIssuance is not provided', () => {
    expect(screen.getByText(/Early issuance reporting/i)).toBeInTheDocument()
    expect(screen.getByText(/No/i)).toBeInTheDocument()
  })
})
