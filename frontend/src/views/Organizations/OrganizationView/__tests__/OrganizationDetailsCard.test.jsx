import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, vi, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'
import { roles } from '@/constants/roles'

import { OrganizationDetailsCard } from '../OrganizationDetailsCard'
import * as CurrentUserHook from '@/hooks/useCurrentUser'

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: { token: 'mock', authenticated: true, initialized: true }
  })
}))

vi.mock('react-router-dom', () => ({
  useParams: () => ({ orgID: '123' }),
  useLocation: () => ({ state: {} }),
  useNavigate: () => vi.fn() // required by BCWidgetCard
}))

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
  useOrganization: () => ({ data: baseOrg, isLoading: false }),
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

const makeUserHook = (user) => ({
  data: user,
  isLoading: false,
  hasRoles: (role) => user.roles.some((r) => r.name === role)
})

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn(() => makeUserHook(govUser))
}))

const renderCard = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ThemeProvider theme={theme}>
        <OrganizationDetailsCard />
      </ThemeProvider>
    </QueryClientProvider>
  )

describe('OrganizationDetailsCard', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders core org fields', () => {
    renderCard()
    expect(screen.getByText('Legal Inc')).toBeInTheDocument()
    expect(screen.getByText('Operating Inc')).toBeInTheDocument()
    expect(screen.getByText('(123) 456-7890')).toBeInTheDocument()
    expect(screen.getByText('test@test.com')).toBeInTheDocument()
  })

  it('renders edit button only for administrators', () => {
    CurrentUserHook.useCurrentUser.mockImplementation(() =>
      makeUserHook(adminUser)
    )
    renderCard()
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
  })

  it('hides edit button for non‑administrators', () => {
    renderCard()
    expect(
      screen.queryByRole('button', { name: /edit/i })
    ).not.toBeInTheDocument()
  })
})
