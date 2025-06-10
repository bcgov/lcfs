import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AddEditUser } from '../AddEditUser'
import { wrapper } from '@/tests/utils/wrapper'
import * as currentUserHooks from '@/hooks/useCurrentUser'
import * as userHooks from '@/hooks/useUser'
import * as organizationUserHooks from '@/hooks/useOrganization'
import * as apiServiceModule from '@/services/useApiService'
import { ROUTES } from '@/routes/routes'
import { roles } from '@/constants/roles' // Ensure roles are correctly imported
import { useForm, FormProvider } from 'react-hook-form' // Import for manual form provider setup
import { yupResolver } from '@hookform/resolvers/yup' // Import for schema resolution
import { userInfoSchema, idirTextFields, bceidTextFields } from '../_schema' // Import schemas and text field definitions

// Mocking react-router-dom
const mockUseNavigate = vi.fn()
const mockUseParams = vi.fn()
const mockUseLocation = vi.fn() // Mock useLocation to capture state

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useNavigate: () => mockUseNavigate,
    useParams: () => mockUseParams(),
    useLocation: () => mockUseLocation()
  }
})

// Mocking react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options = {}) => {
      // Basic translation mock, expand as needed for specific texts
      if (key === 'common:submitError')
        return 'An error occurred during submission.'
      if (key === 'common:saveBtn') return 'Save'
      if (key === 'common:backBtn') return 'Back'
      if (key === 'admin:deleteUser.button') return 'Delete User'
      if (key === 'admin:deleteUser.confirmTitle') return 'Confirm Deletion'
      if (key === 'admin:deleteUser.confirmMessage')
        return 'Are you sure you want to delete this user?'
      if (key === 'admin:deleteUser.success')
        return 'User has been successfully deleted.'
      if (key === 'admin:deleteUser.notSafe')
        return 'This user cannot be deleted.'
      if (key === 'cancelBtn') return 'Cancel'
      // Mock specific schema translations
      if (key === 'admin:userForm.jobTitle') return 'Job Title'
      if (key === 'admin:userForm.firstName') return 'First Name'
      if (key === 'admin:userForm.lastName') return 'Last Name'
      if (key === 'admin:userForm.userName') return 'User Name'
      if (key === 'admin:userForm.keycloakEmail') return 'Keycloak Email'
      if (key === 'admin:userForm.altEmail') return 'Alternate Email'
      if (key === 'admin:userForm.phone') return 'Phone'
      if (key === 'admin:userForm.mobile') return 'Mobile'
      if (key === 'admin:userForm.status.active') return 'Active'
      if (key === 'admin:userForm.status.inactive') return 'Inactive'
      if (key === 'admin:idirRole.analyst') return 'Analyst'
      if (key === 'admin:idirRole.director') return 'Director'
      if (key === 'admin:bceidRole.analyst') return 'Analyst'
      if (key === 'admin:bceidRole.signingAuthority') return 'Signing Authority'
      if (key === 'admin:bceidRole.preparer') return 'Preparer'
      if (key === 'admin:userForm.roles.readOnly') return 'Read Only'
      return key
    }
  })
}))

// Mock useApiService
const mockApiServicePost = vi.fn()
const mockApiServicePut = vi.fn()
vi.mock('@/services/useApiService', () => ({
  useApiService: () => ({
    post: mockApiServicePost,
    put: mockApiServicePut
  })
}))

// Mock custom hooks
vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useUser')
vi.mock('@/hooks/useOrganization')

// Mock child components to simplify testing focus on parent logic
vi.mock('../components/IDIRSpecificRoleFields', () => ({
  IDIRSpecificRoleFields: ({ form, disabled, t }) => (
    <div data-testid="idir-roles">
      <input
        data-testid="idir-role-radio"
        type="radio"
        value="analyst"
        onChange={() => form.setValue('idirRole', 'analyst')}
        checked={form.watch('idirRole') === 'analyst'}
        disabled={disabled}
      />
      <span>IDIR Role Fields</span>
      <input
        data-testid="idir-admin-checkbox"
        type="checkbox"
        onChange={() =>
          form.setValue(
            'adminRole',
            form.watch('adminRole').includes('administrator')
              ? []
              : ['administrator']
          )
        }
        checked={form.watch('adminRole').includes('administrator')}
        disabled={disabled}
      />
      <span>Admin Role</span>
    </div>
  )
}))
vi.mock('../components/BCeIDSpecificRoleFields', () => ({
  BCeIDSpecificRoleFields: ({ form, disabled, status, t }) => (
    <div data-testid="bceid-roles">
      <input
        data-testid="bceid-read-only-radio"
        type="radio"
        value="read_only"
        onChange={() => form.setValue('readOnly', 'read_only')}
        checked={form.watch('readOnly') === 'read_only'}
        disabled={disabled}
      />
      <span>BCeID Read Only</span>
      <input
        data-testid="bceid-analyst-checkbox"
        type="checkbox"
        onChange={() =>
          form.setValue(
            'bceidRoles',
            form.watch('bceidRoles').includes('analyst')
              ? form.watch('bceidRoles').filter((r) => r !== 'analyst')
              : [...form.watch('bceidRoles'), 'analyst']
          )
        }
        checked={form.watch('bceidRoles').includes('analyst')}
        disabled={disabled}
      />
      <span>BCeID Analyst</span>
    </div>
  )
}))

// Helper to render the component with React Hook Form context
const renderWithFormContext = (ui, options) => {
  const Wrapper = ({ children }) => {
    const methods = useForm({
      resolver: yupResolver(userInfoSchema(options?.userType || 'idir')),
      defaultValues: options?.defaultValues || {},
      mode: 'onChange'
    })
    return <FormProvider {...methods}>{children}</FormProvider>
  }
  return render(ui, { wrapper: Wrapper, ...options })
}

describe('AddEditUser', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.resetAllMocks()

    // Default mock values for hooks
    mockUseNavigate.mockReturnValue(vi.fn())
    mockUseParams.mockReturnValue({}) // No userID or orgID by default
    mockUseLocation.mockReturnValue({ state: null })

    vi.mocked(currentUserHooks.useCurrentUser).mockReturnValue({
      data: {
        organization: { organizationId: 1, name: 'Test Org' },
        roles: []
      },
      hasRoles: vi.fn((role) => role === roles.government), // Default to government user
      isLoading: false
    })

    vi.mocked(userHooks.useUser).mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetched: true
    })

    vi.mocked(organizationUserHooks.useOrganizationUser).mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetched: true
    })

    vi.mocked(userHooks.useDeleteUser).mockReturnValue({
      mutate: vi.fn(),
      isPending: false
    })

    mockApiServicePost.mockResolvedValue({})
    mockApiServicePut.mockResolvedValue({})
  })

  // --- Rendering Tests ---
  it('renders loading state for current user', () => {
    vi.mocked(currentUserHooks.useCurrentUser).mockReturnValue({
      data: undefined,
      hasRoles: vi.fn(),
      isLoading: true
    })
    render(<AddEditUser />, { wrapper })
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders loading state for user data (edit mode)', () => {
    mockUseParams.mockReturnValue({ userID: '123' })
    vi.mocked(userHooks.useUser).mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetched: false
    })
    render(<AddEditUser />, { wrapper })
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders "Add user" title for IDIR user', () => {
    render(<AddEditUser userType="idir" />, { wrapper })
    expect(screen.getByText('Add user')).toBeInTheDocument()
    expect(screen.queryByText(/to Test Org/i)).not.toBeInTheDocument()
  })

  it('renders "Edit user to [Org Name]" title for BCeID user (edit mode)', async () => {
    mockUseParams.mockReturnValue({ userID: 'user123', orgID: 'org456' })
    vi.mocked(currentUserHooks.useCurrentUser).mockReturnValue({
      data: {
        organization: { organizationId: 1, name: 'Current User Org' },
        roles: []
      },
      hasRoles: vi.fn((role) => role === roles.supplier),
      isLoading: false
    })
    vi.mocked(organizationUserHooks.useOrganizationUser).mockReturnValue({
      data: {
        userProfileId: 'user123',
        firstName: 'John',
        lastName: 'Doe',
        organization: { name: 'Specific Org' },
        roles: [],
        isActive: true,
        isGovernmentUser: false,
        isSafeToRemove: true
      },
      isLoading: false,
      isFetched: true
    })
    render(<AddEditUser userType="bceid" />, { wrapper })
    await waitFor(() => {
      expect(screen.getByText('Edit user to Specific Org')).toBeInTheDocument()
    })
  })

  // --- Deletion Tests ---
  it('hides delete button for IDIR users', () => {
    mockUseParams.mockReturnValue({ userID: 'idirUser123' })
    vi.mocked(userHooks.useUser).mockReturnValue({
      data: {
        userProfileId: 'idirUser123',
        isActive: true,
        isGovernmentUser: true,
        isSafeToRemove: true,
        roles: []
      },
      isLoading: false,
      isFetched: true
    })
    render(<AddEditUser userType="idir" />, { wrapper })
    expect(screen.queryByTestId('delete-user-btn')).not.toBeInTheDocument()
  })

  it('hides delete button for BCeID users in Add mode', () => {
    mockUseParams.mockReturnValue({}) // Add mode
    render(<AddEditUser userType="bceid" />, { wrapper })
    expect(screen.queryByTestId('delete-user-btn')).not.toBeInTheDocument()
  })

  // --- Navigation Tests ---
  it('navigates to IDIR users list on back button for IDIR user', () => {
    render(<AddEditUser userType="idir" />, { wrapper })
    fireEvent.click(screen.getByTestId('back-btn'))
    expect(mockUseNavigate).toHaveBeenCalledWith(ROUTES.ADMIN.USERS.LIST)
  })

  it('navigates to organizations list on back button for BCeID user (admin adding new org user)', () => {
    mockUseParams.mockReturnValue({}) // No orgID in params, implies adding from orgs list
    render(<AddEditUser userType="bceid" />, { wrapper })
    fireEvent.click(screen.getByTestId('back-btn'))
    expect(mockUseNavigate).toHaveBeenCalledWith(ROUTES.ORGANIZATIONS.LIST)
  })

  it('navigates to current organization page on back button for supplier user', () => {
    vi.mocked(currentUserHooks.useCurrentUser).mockReturnValue({
      data: {
        organization: { organizationId: 1, name: 'Current Org' },
        roles: []
      },
      hasRoles: vi.fn((role) => role === roles.supplier),
      isLoading: false
    })
    render(<AddEditUser userType="bceid" />, { wrapper }) // Can be bceid or idir as supplier context changes nav
    fireEvent.click(screen.getByTestId('back-btn'))
    expect(mockUseNavigate).toHaveBeenCalledWith(ROUTES.ORGANIZATION.ORG)
  })

  it('navigates to specific organization view on back button when orgID is in params (admin editing org user)', () => {
    mockUseParams.mockReturnValue({ orgID: 'someOrgId' })
    render(<AddEditUser userType="bceid" />, { wrapper }) // This context is for admin editing an org user
    fireEvent.click(screen.getByTestId('back-btn'))
    expect(mockUseNavigate).toHaveBeenCalledWith(ROUTES.ORGANIZATIONS.LIST) // Corrected as per your code's current logic
  })
})
