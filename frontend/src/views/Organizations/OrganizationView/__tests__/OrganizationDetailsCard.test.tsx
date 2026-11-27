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
import type { OrganizationData } from '@/hooks/useOrganization'

import { OrganizationDetailsCard } from '../OrganizationDetailsCard'

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
      useNavigate: () => vi.fn() // required by BCWidgetCard
    }
  }
)

const baseOrg = {
  organizationId: '123',
  name: 'Legal Inc',
  operatingName: 'Operating Inc',
  phone: '1234567890',
  email: 'test@test.com',
  contactName: 'Jane Contact',
  edrmsRecord: 'EDRMS-123',
  orgStatus: { status: 'Registered' },
  orgAddress: {},
  orgAttorneyAddress: {},
  hasEarlyIssuance: false
}

// The dashboard Company Overview thread (#4608) is exercised by its own test;
// stub it here so these card tests need no AuthorizationContext/ApiService.
vi.mock('../components/CompanyOverviewComments', () => ({
  CompanyOverviewComments: (_props: Record<string, never>) => (
    <div data-test="company-overview-section" />
  )
}))

vi.mock('@/hooks/useOrganization', () => ({
  useOrganization: testMocks.organization,
  useOrganizationBalance: () => ({
    data: { totalBalance: 200, reservedBalance: 25 }
  }),
  useOrganizationLinkKeys: () => ({ data: [] }),
  useGenerateLinkKey: () => ({ mutate: vi.fn(), isLoading: false }),
  useRegenerateLinkKey: () => ({ mutate: vi.fn(), isLoading: false })
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

const queryClient = new QueryClient()

const Wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>{children}</MemoryRouter>
    </I18nextProvider>
  </QueryClientProvider>
)

describe('OrganizationDetailsCard', () => {
  beforeEach(() => {
    mockCurrentUser.mockImplementation(() => makeUserHook(govUser))
    mockUseOrganization.mockImplementation(() => ({
      data: baseOrg,
      isLoading: false
    }))
  })

  afterEach(() => {
    cleanup()
    // vitest 4: restoreAllMocks only affects vi.spyOn spies, so use
    // resetAllMocks to return vi.fn(impl) module mocks to their defaults
    vi.resetAllMocks()
  })

  it('renders core org fields', () => {
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
    expect(screen.getByText('Jane Contact')).toBeInTheDocument()
    expect(screen.getByText('test@test.com')).toBeInTheDocument()
    expect(screen.getByText('EDRMS-123')).toBeInTheDocument()
  })

  it('renders edit button only for administrators', () => {
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

  it('hides edit button for non‑administrators', () => {
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

  it('shows early issuance for government user when it is false', () => {
    mockCurrentUser.mockImplementation(() => makeUserHook(govUser))
    mockUseOrganization.mockReturnValue({
      data: { hasEarlyIssuance: false, orgStatus: {} },
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
      screen.getByText(/Early issuance reporting enabled for/)
    ).toBeInTheDocument()
    expect(screen.getByText('No')).toBeInTheDocument()
  })

  it('shows early issuance for non-government user only when true', () => {
    mockCurrentUser.mockImplementation(() => makeUserHook(nonGovUser))
    mockUseOrganization.mockReturnValue({
      data: { hasEarlyIssuance: true, orgStatus: {} },
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
      screen.getByText(/Early issuance reporting enabled for/)
    ).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument()
  })

  it('does not show early issuance for non-government user when false', () => {
    mockCurrentUser.mockImplementation(() => makeUserHook(nonGovUser))
    mockUseOrganization.mockReturnValue({
      data: { hasEarlyIssuance: false, orgStatus: {} },
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
      screen.queryByText(/Early issuance reporting enabled for/)
    ).not.toBeInTheDocument()
  })

  it('renders loading state', () => {
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

  it('renders records address when present', () => {
    mockUseOrganization.mockReturnValue({
      data: { ...baseOrg, recordsAddress: '456 Records St' },
      isLoading: false
    })
    render(
      <Wrapper>
        <ThemeProvider theme={theme}>
          <OrganizationDetailsCard />
        </ThemeProvider>
      </Wrapper>
    )
    expect(screen.getByText('456 Records St')).toBeInTheDocument()
  })

  it('shows credit trading disabled', () => {
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
})
