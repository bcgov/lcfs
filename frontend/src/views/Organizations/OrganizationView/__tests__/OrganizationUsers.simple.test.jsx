import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { describe, it, vi, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'
import { roles } from '@/constants/roles'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'

import { OrganizationUsers } from '../OrganizationUsers'

// Mock Keycloak
vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: { token: 'mock', authenticated: true, initialized: true }
  })
}))

// Mock react-router-dom  
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useParams: () => ({ orgID: '123' }),
    useLocation: () => ({ state: {} }),
    useNavigate: () => mockNavigate
  }
})

// Mock current user hook
const govUser = {
  roles: [{ name: roles.government }],
  organization: { organizationId: '456' }
}

const makeUserHook = (user) => ({
  data: user,
  isLoading: false,
  hasRoles: (role) => user.roles.some((r) => r.name === role)
})

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn(() => makeUserHook(govUser))
}))

// Simple mocks for components
vi.mock('@/components/BCDataGrid/BCDataGridServer', () => ({
  __esModule: true,
  default: (props) => <div data-testid="grid">BCDataGridServer</div>
}))

vi.mock('@/components/ClearFiltersButton', () => ({
  ClearFiltersButton: ({ onClick, ...props }) => (
    <button data-testid="clear-filters-button" onClick={onClick} {...props}>
      Clear filters
    </button>
  )
}))

vi.mock('@/components/Role', () => ({
  Role: ({ children }) => <div data-testid="role-wrapper">{children}</div>
}))

vi.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: () => <i data-testid="icon" />
}))

// Mock schema
vi.mock('../_schema', () => ({
  getUserColumnDefs: vi.fn(() => [
    { field: 'firstName', headerName: 'First Name' }
  ]),
  defaultSortModel: [{ field: 'firstName', direction: 'asc' }]
}))

// Mock routes
vi.mock('@/routes/routes', () => ({
  buildPath: vi.fn((route) => `/mock-path/${route}`),
  ROUTES: {
    ORGANIZATIONS: { ADD_USER: 'org-add-user' },
    ORGANIZATION: { ADD_USER: 'add-user' }
  }
}))

vi.mock('@/constants/routes', () => ({
  apiRoutes: {
    orgUsers: '/api/organizations/:orgID/users'
  }
}))

const queryClient = new QueryClient()

const Wrapper = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <ThemeProvider theme={theme}>
          {children}
        </ThemeProvider>
      </MemoryRouter>
    </I18nextProvider>
  </QueryClientProvider>
)

describe('OrganizationUsers', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders component', () => {
    render(
      <Wrapper>
        <OrganizationUsers />
      </Wrapper>
    )
    expect(screen.getByText('org:usersLabel')).toBeInTheDocument()
  })

  it('renders grid', () => {
    render(
      <Wrapper>
        <OrganizationUsers />
      </Wrapper>
    )
    expect(screen.getByTestId('grid')).toBeInTheDocument()
  })

  it('renders clear filters button', () => {
    render(
      <Wrapper>
        <OrganizationUsers />
      </Wrapper>
    )
    expect(screen.getByTestId('clear-filters-button')).toBeInTheDocument()
  })

  it('renders new user button', () => {
    render(
      <Wrapper>
        <OrganizationUsers />
      </Wrapper>
    )
    expect(screen.getByText('org:newUsrBtn')).toBeInTheDocument()
  })

  it('handles clear filters button click', () => {
    render(
      <Wrapper>
        <OrganizationUsers />
      </Wrapper>
    )
    const clearButton = screen.getByTestId('clear-filters-button')
    fireEvent.click(clearButton)
    // Should not throw
  })

  it('handles new user button click', () => {
    render(
      <Wrapper>
        <OrganizationUsers />
      </Wrapper>
    )
    const newUserButton = screen.getByText('org:newUsrBtn')
    fireEvent.click(newUserButton)
    expect(mockNavigate).toHaveBeenCalled()
  })
})