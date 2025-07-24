import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, vi, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'
import { roles } from '@/constants/roles'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'

import { OrganizationDetailsCard } from '../OrganizationDetailsCard'
import * as CurrentUserHook from '@/hooks/useCurrentUser'
import { useOrganization } from '@/hooks/useOrganization'

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: { token: 'mock', authenticated: true, initialized: true }
  })
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useParams: () => ({ orgID: '123' }),
    useLocation: () => ({ state: {} }),
    useNavigate: () => vi.fn() // required by BCWidgetCard
  }
})

const baseOrg = {
  organizationId: '123',
  name: 'Legal Inc',
  operatingName: 'Operating Inc',
  phone: '1234567890',
  email: 'test@test.com',
  orgStatus: { status: 'Registered' },
  orgAddress: {},
  orgAttorneyAddress: {},
  hasEarlyIssuance: false
}

vi.mock('@/hooks/useOrganization', () => ({
  useOrganization: vi.fn(() => ({ data: baseOrg, isLoading: false })),
  useOrganizationBalance: () => ({
    data: { totalBalance: 200, reservedBalance: 25 }
  })
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

const makeUserHook = (user) => ({
  data: user,
  isLoading: false,
  hasRoles: (role) => user.roles.some((r) => r.name === role)
})

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn(() => makeUserHook(govUser))
}))

const queryClient = new QueryClient()

const Wrapper = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>{children}</MemoryRouter>
    </I18nextProvider>
  </QueryClientProvider>
)

const mockGovUser = { hasRoles: () => true }
const mockNonGovUser = { hasRoles: () => false }

describe('OrganizationDetailsCard', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
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
    expect(screen.getByText('test@test.com')).toBeInTheDocument()
  })

  it('renders edit button only for administrators', () => {
    CurrentUserHook.useCurrentUser.mockImplementation(() =>
      makeUserHook(adminUser)
    )
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
    CurrentUserHook.useCurrentUser.mockImplementation(() =>
      makeUserHook(govUser)
    )
    useOrganization.mockReturnValue({
      data: { hasEarlyIssuance: false, orgStatus: {} }
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
    CurrentUserHook.useCurrentUser.mockImplementation(() =>
      makeUserHook(nonGovUser)
    )
    useOrganization.mockReturnValue({
      data: { hasEarlyIssuance: true, orgStatus: {} }
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
    CurrentUserHook.useCurrentUser.mockImplementation(() =>
      makeUserHook(nonGovUser)
    )
    useOrganization.mockReturnValue({
      data: { hasEarlyIssuance: false, orgStatus: {} }
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
})
