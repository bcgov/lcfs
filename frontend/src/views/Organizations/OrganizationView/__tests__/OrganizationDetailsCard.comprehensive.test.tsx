import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, vi, afterEach, beforeEach } from 'vite-plus/test'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ThemeProvider from '@mui/material/styles/ThemeProvider'
import theme from '@/themes'
import { roles } from '@/constants/roles'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import type { ReactNode } from 'react'

import { OrganizationDetailsCard } from '../OrganizationDetailsCard'
import type { OrganizationData } from '@/hooks/useOrganization'

type TestUser = {
  roles: Array<{ name: string }>
  organization: { organizationId: string }
}
type TestUserHook = {
  data: TestUser
  isLoading: boolean
  hasRoles: (role: string) => boolean
}
type OrganizationHookResult = {
  data: OrganizationData | null
  isLoading: boolean
}
const testMocks = vi.hoisted(() => ({
  currentUser: vi.fn<() => TestUserHook>(),
  organization: vi.fn<() => OrganizationHookResult>()
}))

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: { token: 'mock', authenticated: true, initialized: true }
  })
}))

vi.mock(
  'react-router-dom',
  async (
    importOriginal: <T = typeof import('react-router-dom')>() => Promise<T>
  ) => {
    const actual = await importOriginal()
    return {
      ...actual,
      useParams: () => ({ orgID: '123' }),
      useLocation: () => ({ state: {} }),
      useNavigate: () => vi.fn()
    }
  }
)

const baseOrg = {
  organizationId: '123',
  name: 'Legal Inc',
  operatingName: 'Operating Inc',
  phone: '1234567890',
  email: 'test@test.com',
  orgStatus: { status: 'Registered' },
  orgAddress: {},
  orgAttorneyAddress: {},
  hasEarlyIssuance: false,
  creditTradingEnabled: true
}

// The dashboard Company Overview thread (#4608) is exercised by its own test;
// stub it here so these card tests need no AuthorizationContext/ApiService.
vi.mock('../components/CompanyOverviewComments', () => ({
  CompanyOverviewComments: () => <div data-test="company-overview-section" />
}))

vi.mock('@/hooks/useOrganization', () => ({
  useOrganization: testMocks.organization,
  useOrganizationBalance: () => ({
    data: { totalBalance: 200, reservedBalance: 25 }
  }),
  useAvailableFormTypes: () => ({ data: [] }),
  useOrganizationLinkKeys: () => ({ data: [] }),
  useGenerateLinkKey: () => ({ mutate: vi.fn(), isLoading: false }),
  useRegenerateLinkKey: () => ({ mutate: vi.fn(), isLoading: false })
}))

// Mock Role component to always render children for government role
vi.mock('@/components/Role', () => ({
  Role: ({ children }: { children: ReactNode }) => {
    // Always show children for this test (we're mocking appropriate user roles)
    return <div data-test="role-component">{children}</div>
  }
}))

const govUser = {
  roles: [{ name: roles.government }],
  organization: { organizationId: '123' }
}
const adminUser = {
  roles: [{ name: roles.administrator }],
  organization: { organizationId: '123' }
}
const nonGovUser = {
  roles: [{ name: 'bceid' }],
  organization: { organizationId: '123' }
}

const makeUserHook = (user: TestUser): TestUserHook => ({
  data: user,
  isLoading: false,
  hasRoles: (role: string) => user.roles.some((r) => r.name === role)
})

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: testMocks.currentUser
}))

testMocks.currentUser.mockImplementation(() => makeUserHook(govUser))
testMocks.organization.mockImplementation(() => ({
  data: baseOrg,
  isLoading: false
}))
const { currentUser: mockCurrentUser, organization: mockUseOrganization } =
  testMocks

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
})

const Wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>{children}</MemoryRouter>
    </I18nextProvider>
  </QueryClientProvider>
)

describe('OrganizationDetailsCard Comprehensive Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCurrentUser.mockImplementation(() => makeUserHook(govUser))
    mockUseOrganization.mockReturnValue({ data: baseOrg, isLoading: false })
  })

  afterEach(() => {
    cleanup()
  })

  // Basic Rendering Tests
  it('renders core organization fields', () => {
    render(
      <Wrapper>
        <ThemeProvider theme={theme}>
          <OrganizationDetailsCard />
        </ThemeProvider>
      </Wrapper>
    )
    expect(screen.getByText('Legal Inc')).toBeInTheDocument()
    expect(screen.getByText('Operating Inc')).toBeInTheDocument()
    expect(screen.getByText('(123) 456-7890')).toBeInTheDocument()
    expect(screen.getByText('test@test.com')).toBeInTheDocument()
  })

  // Loading State Tests (Line 52-53)
  it('renders loading state when data is loading', () => {
    mockUseOrganization.mockReturnValue({
      data: null,
      isLoading: true
    })
    render(
      <Wrapper>
        <ThemeProvider theme={theme}>
          <OrganizationDetailsCard />
        </ThemeProvider>
      </Wrapper>
    )
    expect(screen.getByTestId('loading')).toBeInTheDocument()
  })

  it('does not render loading state when data is available', () => {
    render(
      <Wrapper>
        <ThemeProvider theme={theme}>
          <OrganizationDetailsCard />
        </ThemeProvider>
      </Wrapper>
    )
    expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
  })

  // Role-based Access Control Tests
  it('shows edit button for administrator users', () => {
    mockCurrentUser.mockImplementation(() => makeUserHook(adminUser))
    render(
      <Wrapper>
        <ThemeProvider theme={theme}>
          <OrganizationDetailsCard />
        </ThemeProvider>
      </Wrapper>
    )
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
  })

  it('hides edit button for non-administrator users', () => {
    mockCurrentUser.mockImplementation(() => makeUserHook(nonGovUser))
    render(
      <Wrapper>
        <ThemeProvider theme={theme}>
          <OrganizationDetailsCard />
        </ThemeProvider>
      </Wrapper>
    )
    expect(
      screen.queryByRole('button', { name: /edit/i })
    ).not.toBeInTheDocument()
  })

  // Records Address Conditional Tests (Lines 130-133)
  it('renders records address when present', () => {
    mockUseOrganization.mockReturnValue({
      data: { ...baseOrg, recordsAddress: '456 Records Street' },
      isLoading: false
    })
    render(
      <Wrapper>
        <ThemeProvider theme={theme}>
          <OrganizationDetailsCard />
        </ThemeProvider>
      </Wrapper>
    )
    expect(screen.getByText('456 Records Street')).toBeInTheDocument()
  })

  it('does not render records address when absent', () => {
    mockUseOrganization.mockReturnValue({
      data: { ...baseOrg, recordsAddress: null },
      isLoading: false
    })
    render(
      <Wrapper>
        <ThemeProvider theme={theme}>
          <OrganizationDetailsCard />
        </ThemeProvider>
      </Wrapper>
    )
    expect(screen.queryByText(/BC Records Address/)).not.toBeInTheDocument()
  })

  // Credit Trading Tests (Line 149)
  it('shows credit trading enabled for registered organization', () => {
    mockUseOrganization.mockReturnValue({
      data: {
        ...baseOrg,
        orgStatus: { status: 'Registered' },
        creditTradingEnabled: true
      },
      isLoading: false
    })
    render(
      <Wrapper>
        <ThemeProvider theme={theme}>
          <OrganizationDetailsCard />
        </ThemeProvider>
      </Wrapper>
    )
    expect(screen.getByText(/Registered for transfers/)).toBeInTheDocument()
  })

  it('shows credit trading disabled for registered organization', () => {
    mockUseOrganization.mockReturnValue({
      data: {
        ...baseOrg,
        orgStatus: { status: 'Registered' },
        creditTradingEnabled: false
      },
      isLoading: false
    })
    render(
      <Wrapper>
        <ThemeProvider theme={theme}>
          <OrganizationDetailsCard />
        </ThemeProvider>
      </Wrapper>
    )
    const noElements = screen.getAllByText('No')
    expect(noElements.length).toBeGreaterThan(0)
  })

  it('does not show credit trading for non-registered organization', () => {
    mockUseOrganization.mockReturnValue({
      data: {
        ...baseOrg,
        orgStatus: { status: 'Unregistered' },
        creditTradingEnabled: true
      },
      isLoading: false
    })
    render(
      <Wrapper>
        <ThemeProvider theme={theme}>
          <OrganizationDetailsCard />
        </ThemeProvider>
      </Wrapper>
    )
    expect(
      screen.queryByText(/creditTradingEnabledLabel/)
    ).not.toBeInTheDocument()
  })

  // Early Issuance Tests
  it('shows early issuance for government user when false', () => {
    mockCurrentUser.mockImplementation(() => makeUserHook(govUser))
    mockUseOrganization.mockReturnValue({
      data: { ...baseOrg, hasEarlyIssuance: false },
      isLoading: false
    })
    render(
      <Wrapper>
        <ThemeProvider theme={theme}>
          <OrganizationDetailsCard />
        </ThemeProvider>
      </Wrapper>
    )
    expect(
      screen.getByText(/Early issuance reporting enabled/)
    ).toBeInTheDocument()
    expect(screen.getAllByText('No')[0]).toBeInTheDocument()
  })

  it('shows early issuance for government user when true', () => {
    mockCurrentUser.mockImplementation(() => makeUserHook(govUser))
    mockUseOrganization.mockReturnValue({
      data: { ...baseOrg, hasEarlyIssuance: true },
      isLoading: false
    })
    render(
      <Wrapper>
        <ThemeProvider theme={theme}>
          <OrganizationDetailsCard />
        </ThemeProvider>
      </Wrapper>
    )
    expect(
      screen.getByText(/Early issuance reporting enabled/)
    ).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument() // Early issuance should be Yes
  })

  it('shows early issuance for non-government user only when true', () => {
    mockCurrentUser.mockImplementation(() => makeUserHook(nonGovUser))
    mockUseOrganization.mockReturnValue({
      data: { ...baseOrg, hasEarlyIssuance: true },
      isLoading: false
    })
    render(
      <Wrapper>
        <ThemeProvider theme={theme}>
          <OrganizationDetailsCard />
        </ThemeProvider>
      </Wrapper>
    )
    expect(
      screen.getByText(/Early issuance reporting enabled/)
    ).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument() // Early issuance should be Yes
  })

  it('does not show early issuance for non-government user when false', () => {
    mockCurrentUser.mockImplementation(() => makeUserHook(nonGovUser))
    mockUseOrganization.mockReturnValue({
      data: { ...baseOrg, hasEarlyIssuance: false },
      isLoading: false
    })
    render(
      <Wrapper>
        <ThemeProvider theme={theme}>
          <OrganizationDetailsCard />
        </ThemeProvider>
      </Wrapper>
    )
    expect(
      screen.queryByText(/Early issuance reporting enabled/)
    ).not.toBeInTheDocument()
  })

  // User-specific Message Tests
  it('shows update message for non-government users', () => {
    mockCurrentUser.mockImplementation(() => ({
      ...makeUserHook(nonGovUser),
      isLoading: false
    }))
    render(
      <Wrapper>
        <ThemeProvider theme={theme}>
          <OrganizationDetailsCard />
        </ThemeProvider>
      </Wrapper>
    )
    expect(screen.getByText(/To update/)).toBeInTheDocument()
  })

  it('does not show update message for government users', () => {
    mockCurrentUser.mockImplementation(() => ({
      ...makeUserHook(govUser),
      isLoading: false
    }))
    render(
      <Wrapper>
        <ThemeProvider theme={theme}>
          <OrganizationDetailsCard />
        </ThemeProvider>
      </Wrapper>
    )
    expect(screen.queryByText(/To update/)).not.toBeInTheDocument()
  })

  // Data Formatting Tests
  it('renders formatted phone number', () => {
    render(
      <Wrapper>
        <ThemeProvider theme={theme}>
          <OrganizationDetailsCard />
        </ThemeProvider>
      </Wrapper>
    )
    expect(screen.getByText('(123) 456-7890')).toBeInTheDocument()
  })

  it('renders operating name fallback to legal name when operating name is missing', () => {
    mockUseOrganization.mockReturnValue({
      data: { ...baseOrg, operatingName: null },
      isLoading: false
    })
    render(
      <Wrapper>
        <ThemeProvider theme={theme}>
          <OrganizationDetailsCard />
        </ThemeProvider>
      </Wrapper>
    )
    expect(screen.getAllByText('Legal Inc')).toHaveLength(2)
  })

  // Balance Information Tests
  it('shows compliance unit balance for government users', () => {
    mockCurrentUser.mockImplementation(() => makeUserHook(govUser))
    render(
      <Wrapper>
        <ThemeProvider theme={theme}>
          <OrganizationDetailsCard />
        </ThemeProvider>
      </Wrapper>
    )
    expect(screen.getByText(/Compliance unit balance/)).toBeInTheDocument()
    expect(screen.getByText('200 (25)')).toBeInTheDocument()
  })

  // Registration Status Tests
  it('shows registered transfer status for registered organization', () => {
    render(
      <Wrapper>
        <ThemeProvider theme={theme}>
          <OrganizationDetailsCard />
        </ThemeProvider>
      </Wrapper>
    )
    expect(screen.getByText(/Registered for transfer/)).toBeInTheDocument()
    expect(
      screen.getByText(/Yes — A registered organization/)
    ).toBeInTheDocument()
  })

  it('shows unregistered transfer status for unregistered organization', () => {
    mockUseOrganization.mockReturnValue({
      data: {
        ...baseOrg,
        orgStatus: { status: 'Unregistered' }
      },
      isLoading: false
    })
    render(
      <Wrapper>
        <ThemeProvider theme={theme}>
          <OrganizationDetailsCard />
        </ThemeProvider>
      </Wrapper>
    )
    expect(screen.getByText(/Registered for transfer/)).toBeInTheDocument()
    const noElements = screen.getAllByText('No')
    expect(noElements.length).toBeGreaterThan(0)
  })
})
