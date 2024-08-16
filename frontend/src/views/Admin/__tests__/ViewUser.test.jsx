import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'
import { ViewUser } from '../AdminMenu/components/ViewUser'
import * as useUserHook from '@/hooks/useUser'
import * as useCurrentUserHook from '@/hooks/useCurrentUser'
import * as useOrganizationHook from '@/hooks/useOrganization'
import * as formatters from '@/utils/formatters'

// Mocks
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}))

vi.mock('@/utils/cellRenderers', () => ({
  RoleSpanRenderer: vi.fn(() => <span>Mocked Roles</span>),
  StatusRenderer: vi.fn(() => <span>Mocked Status</span>),
}))

vi.mock('@/components/Loading', () => ({
  default: () => <div data-test="loading">Loading...</div>,
}))

vi.mock('@/components/Role', () => ({
  Role: ({ children }) => <>{children}</>,
}))

vi.mock('@/components/BCDataGrid/BCDataGridClient', () => ({
  default: () => <div data-test="mocked-data-grid">Mocked DataGrid</div>,
}))

vi.mock('@/hooks/useUser')
vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useOrganization')

// Helper component to access current location
const LocationDisplay = () => {
  const location = useLocation()
  return <div data-test="location-display">{location.pathname}</div>
}

const WrapperComponent = ({ children, initialEntries = ['/admin/users/1'] }) => {
  const queryClient = new QueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route path="*" element={
              <>
                {children}
                <LocationDisplay />
              </>
            } />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

const mockUser = {
  firstName: 'John',
  lastName: 'Doe',
  keycloakEmail: 'john.doe@example.com',
  phone: '1234567890',
  mobilePhone: '0987654321',
  title: 'Developer',
  organization: { name: 'Test Org' },
}

describe('ViewUser Component', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    // Mock the phoneNumberFormatter
    vi.spyOn(formatters, 'phoneNumberFormatter').mockImplementation(
      (params) => `Formatted: ${params.value}`
    )

    // Set up default mock return values
    vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
      hasRoles: vi.fn(() => false),
      data: { 
        organization: { organizationId: '123' },
        roles: []
      },
    })

    vi.mocked(useUserHook.useUser).mockReturnValue({
      data: mockUser,
      isLoading: false,
      isLoadingError: false,
    })

    vi.mocked(useOrganizationHook.useOrganizationUser).mockReturnValue({
      data: mockUser,
      isLoading: false,
      isLoadingError: false,
    })
  })

  it('renders loading state', () => {
    vi.mocked(useUserHook.useUser).mockReturnValue({
      isLoading: true,
    })

    render(<WrapperComponent><ViewUser /></WrapperComponent>)
    expect(screen.getByTestId('loading')).toBeInTheDocument()
  })

  it('renders error state', () => {
    vi.mocked(useUserHook.useUser).mockReturnValue({
      isLoadingError: true,
    })

    render(<WrapperComponent><ViewUser /></WrapperComponent>)
    expect(screen.getByText('admin:errMsg')).toBeInTheDocument()
  })

  it('renders user details correctly', () => {
    render(<WrapperComponent><ViewUser /></WrapperComponent>)

    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('john.doe@example.com')).toBeInTheDocument()
    expect(screen.getByText('Formatted: 1234567890')).toBeInTheDocument()
    expect(screen.getByText('Formatted: 0987654321')).toBeInTheDocument()
    expect(screen.getByText('Developer')).toBeInTheDocument()
    expect(screen.getByText('Test Org')).toBeInTheDocument()
  })

  it('navigates to edit page when edit button is clicked', async () => {
    vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
      hasRoles: vi.fn(() => true),
      data: { 
        organization: { organizationId: '123' },
        roles: [{ name: 'administrator' }]
      },
    })

    render(<WrapperComponent><ViewUser /></WrapperComponent>)

    const editButton = screen.getByLabelText('edit')
    fireEvent.click(editButton)

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/organization/undefined/edit-user')
    })
  })

  it('renders BCDataGridClient with correct props', () => {
    render(<WrapperComponent><ViewUser /></WrapperComponent>)
    expect(screen.getByTestId('mocked-data-grid')).toBeInTheDocument()
  })
})