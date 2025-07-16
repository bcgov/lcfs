import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AddEditUser } from '../AddEditUser'
import { wrapper } from '@/tests/utils/wrapper'
import { HttpResponse } from 'msw'
import { httpOverwrite } from '@/tests/utils/handlers'
import * as currentUserHooks from '@/hooks/useCurrentUser'
import * as userHooks from '@/hooks/useUser'
import * as organizationUserHooks from '@/hooks/useOrganization'
import { ROUTES } from '@/routes/routes'
import { roles } from '@/constants/roles'
import { useForm, FormProvider } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { userInfoSchema, idirTextFields, bceidTextFields } from '../_schema'

// Mocking react-router-dom
const mockUseNavigate = vi.fn()
const mockUseParams = vi.fn()
const mockUseLocation = vi.fn()

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

describe('AddEditUser', () => {
  // Mock the mutation functions
  const mockUpdateUser = vi.fn()
  const mockCreateUser = vi.fn()
  const mockDeleteUser = vi.fn()

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

    // Mock the new hooks
    vi.mocked(userHooks.useUpdateUser).mockReturnValue({
      mutate: mockUpdateUser,
      isPending: false,
      isError: false
    })

    vi.mocked(userHooks.useCreateUser).mockReturnValue({
      mutate: mockCreateUser,
      isPending: false,
      isError: false
    })

    vi.mocked(userHooks.useDeleteUser).mockReturnValue({
      mutate: mockDeleteUser,
      isPending: false
    })
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

  it('renders loading state when updating user', () => {
    // Mock userID to trigger edit mode
    mockUseParams.mockReturnValue({ userID: 'user123' })

    vi.mocked(userHooks.useUpdateUser).mockReturnValue({
      mutate: mockUpdateUser,
      isPending: true, // User is being updated
      isError: false
    })
    render(<AddEditUser />, { wrapper })
    expect(screen.getByText('Updating user...')).toBeInTheDocument()
  })

  it('renders loading state when creating user', () => {
    // No userID means add mode
    mockUseParams.mockReturnValue({})

    vi.mocked(userHooks.useCreateUser).mockReturnValue({
      mutate: mockCreateUser,
      isPending: true, // User is being created
      isError: false
    })
    render(<AddEditUser />, { wrapper })
    expect(screen.getByText('Adding user...')).toBeInTheDocument()
  })

  it('renders error alert when update fails', () => {
    vi.mocked(userHooks.useUpdateUser).mockReturnValue({
      mutate: mockUpdateUser,
      isPending: false,
      isError: true // Update failed
    })
    render(<AddEditUser />, { wrapper })
    expect(
      screen.getByText('An error occurred during submission.')
    ).toBeInTheDocument()
  })

  it('renders error alert when create fails', () => {
    vi.mocked(userHooks.useCreateUser).mockReturnValue({
      mutate: mockCreateUser,
      isPending: false,
      isError: true // Create failed
    })
    render(<AddEditUser />, { wrapper })
    expect(
      screen.getByText('An error occurred during submission.')
    ).toBeInTheDocument()
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

  // --- Form Submission Tests ---
  it('calls createUser when submitting in add mode', async () => {
    mockUseParams.mockReturnValue({}) // Add mode (no userID)

    // Mock current user with proper organization data
    vi.mocked(currentUserHooks.useCurrentUser).mockReturnValue({
      data: {
        organization: { organizationId: 1, name: 'Test Org' },
        organizationId: 1, // Add this for the payload
        roles: []
      },
      hasRoles: vi.fn((role) => role === roles.government),
      isLoading: false
    })

    render(<AddEditUser userType="idir" />, { wrapper })

    // Fill out REQUIRED form fields based on schema
    // For IDIR: firstName, lastName, jobTitle, userName, keycloakEmail are required
    fireEvent.change(screen.getByRole('textbox', { name: /first name/i }), {
      target: { value: 'John' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: /last name/i }), {
      target: { value: 'Doe' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: /job title/i }), {
      target: { value: 'Developer' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: /username/i }), {
      target: { value: 'john.doe' }
    })
    // Look for email field - could be "Email" or "Keycloak Email"
    const emailField = screen.getByRole('textbox', { name: /email/i })
    fireEvent.change(emailField, {
      target: { value: 'john@example.com' }
    })

    // Submit the form
    fireEvent.click(screen.getByTestId('saveUser'))

    await waitFor(() => {
      expect(mockCreateUser).toHaveBeenCalled()
      expect(mockUpdateUser).not.toHaveBeenCalled()
    })
  })

  it('calls createUser for BCeID user with correct required fields', async () => {
    mockUseParams.mockReturnValue({ orgID: 'org123' }) // BCeID context with orgID

    vi.mocked(currentUserHooks.useCurrentUser).mockReturnValue({
      data: {
        organization: { organizationId: 1, name: 'Test Org' },
        organizationId: 1,
        roles: []
      },
      hasRoles: vi.fn((role) => role === roles.supplier),
      isLoading: false
    })

    render(<AddEditUser userType="bceid" />, { wrapper })

    // Fill out REQUIRED form fields for BCeID
    // For BCeID: firstName, lastName, userName, keycloakEmail are required (jobTitle is optional)
    fireEvent.change(screen.getByRole('textbox', { name: /first name/i }), {
      target: { value: 'Jane' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: /last name/i }), {
      target: { value: 'Smith' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: /username/i }), {
      target: { value: 'jane.smith' }
    })
    // For BCeID, look for "BCeID Email" field
    const emailField = screen.getAllByRole('textbox', { name: /email/i })[0]
    fireEvent.change(emailField, {
      target: { value: 'jane@company.com' }
    })

    // Submit the form
    fireEvent.click(screen.getByTestId('saveUser'))

    await waitFor(() => {
      expect(mockCreateUser).toHaveBeenCalled()
      expect(mockUpdateUser).not.toHaveBeenCalled()
    })
  })

  it('calls updateUser when submitting in edit mode', async () => {
    mockUseParams.mockReturnValue({ userID: 'user123' }) // Edit mode

    vi.mocked(userHooks.useUser).mockReturnValue({
      data: {
        userProfileId: 'user123',
        firstName: 'John',
        lastName: 'Doe',
        title: 'Developer',
        keycloakEmail: 'john@example.com',
        keycloakUsername: 'john.doe',
        phone: '123-456-7890',
        mobilePhone: '098-765-4321',
        email: 'john.alt@example.com',
        roles: [{ name: 'analyst' }],
        isActive: true,
        isGovernmentUser: true
      },
      isLoading: false,
      isFetched: true
    })

    // Mock current user with proper organization data
    vi.mocked(currentUserHooks.useCurrentUser).mockReturnValue({
      data: {
        organization: { organizationId: 1, name: 'Test Org' },
        organizationId: 1,
        roles: []
      },
      hasRoles: vi.fn((role) => role === roles.government),
      isLoading: false
    })

    render(<AddEditUser userType="idir" />, { wrapper })

    // Wait for form to populate with existing data
    await waitFor(() => {
      expect(screen.getByDisplayValue('John')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Doe')).toBeInTheDocument()
    })

    // Submit the form
    fireEvent.click(screen.getByTestId('saveUser'))

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({
        userID: 'user123',
        payload: expect.objectContaining({
          userProfileId: 'user123',
          firstName: 'John',
          lastName: 'Doe'
        })
      })
      expect(mockCreateUser).not.toHaveBeenCalled()
    })
  })

  it('includes correct payload structure for government user', async () => {
    mockUseParams.mockReturnValue({}) // Add mode

    // Mock current user as government user
    vi.mocked(currentUserHooks.useCurrentUser).mockReturnValue({
      data: {
        organization: { organizationId: 1, name: 'Test Org' },
        organizationId: 1,
        roles: []
      },
      hasRoles: vi.fn((role) => role === roles.government),
      isLoading: false
    })

    render(<AddEditUser userType="idir" />, { wrapper })

    // Fill out required form fields based on schema
    fireEvent.change(screen.getByRole('textbox', { name: /first name/i }), {
      target: { value: 'John' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: /last name/i }), {
      target: { value: 'Doe' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: /job title/i }), {
      target: { value: 'Analyst' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: /username/i }), {
      target: { value: 'john.doe' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: /email/i }), {
      target: { value: 'john@gov.bc.ca' }
    })

    // Submit the form
    fireEvent.click(screen.getByTestId('saveUser'))

    await waitFor(() => {
      expect(mockCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'John',
          lastName: 'Doe',
          title: 'Analyst',
          keycloakUsername: 'john.doe',
          keycloakEmail: 'john@gov.bc.ca',
          roles: expect.arrayContaining(['government'])
        })
      )
    })
  })

  it('includes correct payload structure for supplier user', async () => {
    mockUseParams.mockReturnValue({ orgID: 'org123' }) // Supplier context

    vi.mocked(currentUserHooks.useCurrentUser).mockReturnValue({
      data: {
        organization: { organizationId: 1, name: 'Test Org' },
        organizationId: 1,
        roles: []
      },
      hasRoles: vi.fn((role) => role === roles.supplier),
      isLoading: false
    })

    render(<AddEditUser userType="bceid" />, { wrapper })

    // Fill out required form fields for BCeID (jobTitle is optional for BCeID)
    fireEvent.change(screen.getByRole('textbox', { name: /first name/i }), {
      target: { value: 'Jane' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: /last name/i }), {
      target: { value: 'Smith' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: /username/i }), {
      target: { value: 'jane.smith' }
    })
    fireEvent.change(screen.getAllByRole('textbox', { name: /email/i })[0], {
      target: { value: 'jane@company.com' }
    })

    // Submit the form
    fireEvent.click(screen.getByTestId('saveUser'))

    await waitFor(() => {
      expect(mockCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'Jane',
          lastName: 'Smith',
          keycloakUsername: 'jane.smith',
          keycloakEmail: 'jane@company.com',
          roles: expect.arrayContaining(['supplier']),
          organizationId: 'org123'
        })
      )
    })
  })

  it('handles form validation errors for missing required fields', async () => {
    mockUseParams.mockReturnValue({}) // Add mode

    render(<AddEditUser userType="idir" />, { wrapper })

    // Try to submit form without filling required fields
    fireEvent.click(screen.getByTestId('saveUser'))

    // The mutation should not be called if validation fails
    await waitFor(() => {
      expect(mockCreateUser).not.toHaveBeenCalled()
    })
  })

  it('validates email format correctly', async () => {
    mockUseParams.mockReturnValue({}) // Add mode

    vi.mocked(currentUserHooks.useCurrentUser).mockReturnValue({
      data: {
        organization: { organizationId: 1, name: 'Test Org' },
        organizationId: 1,
        roles: []
      },
      hasRoles: vi.fn((role) => role === roles.government),
      isLoading: false
    })

    render(<AddEditUser userType="idir" />, { wrapper })

    // Fill out required fields with invalid email
    fireEvent.change(screen.getByRole('textbox', { name: /first name/i }), {
      target: { value: 'John' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: /last name/i }), {
      target: { value: 'Doe' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: /job title/i }), {
      target: { value: 'Developer' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: /username/i }), {
      target: { value: 'john.doe' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: /email/i }), {
      target: { value: 'invalid-email' } // Invalid email format
    })

    // Submit the form
    fireEvent.click(screen.getByTestId('saveUser'))

    // The mutation should not be called due to validation error
    await waitFor(() => {
      expect(mockCreateUser).not.toHaveBeenCalled()
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
    render(<AddEditUser userType="bceid" />, { wrapper })
    fireEvent.click(screen.getByTestId('back-btn'))
    expect(mockUseNavigate).toHaveBeenCalledWith(ROUTES.ORGANIZATION.ORG)
  })

  it('navigates to organizations list on back button when orgID is in params (admin editing org user)', () => {
    mockUseParams.mockReturnValue({ orgID: 'someOrgId' })
    render(<AddEditUser userType="bceid" />, { wrapper })
    fireEvent.click(screen.getByTestId('back-btn'))
    expect(mockUseNavigate).toHaveBeenCalledWith(ROUTES.ORGANIZATIONS.LIST)
  })

  // --- Form State Tests ---
  it('disables role fields when status is Inactive', async () => {
    render(<AddEditUser userType="idir" />, { wrapper })

    // Set status to Inactive
    const statusRadios = screen.getAllByRole('radio')
    const inactiveRadio = statusRadios.find((radio) =>
      radio.closest('label')?.textContent?.includes('Inactive')
    )

    if (inactiveRadio) {
      fireEvent.click(inactiveRadio)

      await waitFor(() => {
        expect(screen.getByTestId('idir-role-radio')).toBeDisabled()
        expect(screen.getByTestId('idir-admin-checkbox')).toBeDisabled()
      })
    }
  })

  it('enables role fields when status is Active', async () => {
    render(<AddEditUser userType="idir" />, { wrapper })

    // Status should be Active by default, but let's explicitly set it
    const statusRadios = screen.getAllByRole('radio')
    const activeRadio = statusRadios.find((radio) =>
      radio.closest('label')?.textContent?.includes('Active')
    )

    if (activeRadio) {
      fireEvent.click(activeRadio)

      await waitFor(() => {
        expect(screen.getByTestId('idir-role-radio')).not.toBeDisabled()
        expect(screen.getByTestId('idir-admin-checkbox')).not.toBeDisabled()
      })
    }
  })
})
