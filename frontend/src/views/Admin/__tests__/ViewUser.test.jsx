import React from 'react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useLocation } from 'react-router-dom'
import * as useUserHook from '@/hooks/useUser'
import * as useCurrentUserHook from '@/hooks/useCurrentUser'
import * as useOrganizationHook from '@/hooks/useOrganization'
import * as formatters from '@/utils/formatters'
import { wrapper } from '@/tests/utils/wrapper'
import { ViewUser } from '../AdminMenu/components/ViewUser'

// Mocks
vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: {
      token: 'test-token',
      authenticated: true
    }
  })
}))

vi.mock('@/utils/cellRenderers', () => ({
  RoleSpanRenderer: vi.fn(({ data }) => (
    <>
      {data.roles.map((role, index) => (
        <span key={index}>Mocked Role: {role.name}</span>
      ))}
    </>
  )),
  StatusRenderer: vi.fn(() => <span>Mocked Status</span>)
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('@/components/Loading', () => ({
  default: () => <div data-test="loading">Loading...</div>
}))

vi.mock('@/components/Role', () => ({
  Role: ({ children }) => <>{children}</>
}))

vi.mock('@/components/BCDataGrid/BCDataGridServer', () => ({
  default: () => <div data-test="mocked-data-grid">Mocked DataGrid</div>
}))

vi.mock('@/hooks/useUser')
vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useOrganization')

// Helper component to access current location
const LocationDisplay = () => {
  const location = useLocation()
  return <div data-test="location-display">{location.pathname}</div>
}

const mockUser = {
  firstName: 'John',
  lastName: 'Doe',
  keycloakEmail: 'john.doe@example.com',
  phone: '1234567890',
  mobilePhone: '0987654321',
  title: 'Developer',
  organization: { name: 'Test Org' },
  roles: [{ name: 'administrator' }, { name: 'user' }]
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
      }
    })

    vi.mocked(useUserHook.useUser).mockReturnValue({
      data: mockUser,
      isLoading: false,
      isLoadingError: false,
      isError: false
    })

    vi.mocked(useOrganizationHook.useOrganizationUser).mockReturnValue({
      data: mockUser,
      isLoading: false,
      isLoadingError: false
    })
  })

  it('renders loading state', () => {
    vi.mocked(useUserHook.useUser).mockReturnValue({
      isLoading: true
    })

    render(<ViewUser />, { wrapper })
    expect(screen.getByTestId('loading')).toBeInTheDocument()
  })

  it('renders error state', () => {
    const errorMessage = 'An error occurred'
    vi.mocked(useUserHook.useUser).mockReturnValue({
      isError: true,
      error: { message: errorMessage }
    })

    render(<ViewUser />, { wrapper })
    expect(screen.getByText(errorMessage)).toBeInTheDocument()
  })

  it('renders user details correctly', () => {
    render(<ViewUser />, { wrapper })

    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('john.doe@example.com')).toBeInTheDocument()
    expect(screen.getByText('Formatted: 1234567890')).toBeInTheDocument()
    expect(screen.getByText('Formatted: 0987654321')).toBeInTheDocument()
    expect(screen.getByText('Developer')).toBeInTheDocument()
    expect(screen.getByText('Test Org')).toBeInTheDocument()
    expect(screen.getByText('administrator')).toBeInTheDocument()
    expect(screen.getByText('user')).toBeInTheDocument()
  })

  it('navigates to edit page when edit button is clicked', async () => {
    vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
      hasRoles: vi.fn(() => true),
      data: {
        organization: { organizationId: '123' },
        roles: [{ name: 'administrator' }]
      }
    })

    render(
      <>
        <ViewUser />
        <LocationDisplay />
      </>,
      {
        wrapper: ({ children }) =>
          wrapper({ children, initialEntries: ['/admin/users/1'] })
      }
    )

    const editButton = screen.getByLabelText('edit')
    fireEvent.click(editButton)

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent(
        '/organization/undefined/edit-user'
      )
    })
  })

  it('renders BCDataGridServer with correct props', () => {
    render(<ViewUser />, { wrapper })
    expect(screen.getByTestId('mocked-data-grid')).toBeInTheDocument()
  })
})
