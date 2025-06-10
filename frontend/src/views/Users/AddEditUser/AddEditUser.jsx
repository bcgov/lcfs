import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AddEditUser } from '../AddEditUser'
import { wrapper } from '@/tests/utils/wrapper'
import { useUser, useDeleteUser } from '@/hooks/useUser'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useOrganizationUser } from '@/hooks/useOrganization'

// Mock react-router-dom hooks
const mockUseNavigate = vi.fn()
const mockUseParams = vi.fn()

vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useNavigate: () => mockUseNavigate(),
  useParams: () => mockUseParams()
}))

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

// Mock hooks
vi.mock('@/hooks/useUser')
vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useOrganization')

// Mock @tanstack/react-query
vi.mock('@tanstack/react-query', () => ({
  useMutation: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false
  }))
}))

// Mock useApiService
vi.mock('@/services/useApiService', () => ({
  useApiService: () => ({
    put: vi.fn(),
    post: vi.fn()
  })
}))

// Mock react-hook-form
const mockSetValue = vi.fn()
const mockReset = vi.fn()
const mockWatch = vi.fn()
const mockHandleSubmit = vi.fn()

vi.mock('react-hook-form', () => ({
  useForm: () => ({
    handleSubmit: mockHandleSubmit.mockReturnValue(vi.fn()),
    control: {},
    setValue: mockSetValue,
    watch: mockWatch,
    reset: mockReset
  }),
  FormProvider: ({ children }) => (
    <div data-test="form-provider">{children}</div>
  )
}))

// Mock schema
vi.mock('./_schema', () => ({
  userInfoSchema: () => ({}),
  idirTextFields: (t) => [
    { name: 'firstName', label: 'First Name', optional: false },
    { name: 'lastName', label: 'Last Name', optional: false },
    { name: 'keycloakEmail', label: 'Email', optional: false }
  ],
  bceidTextFields: (t) => [
    { name: 'firstName', label: 'First Name', optional: false },
    { name: 'lastName', label: 'Last Name', optional: false },
    { name: 'keycloakEmail', label: 'Email', optional: false },
    { name: 'jobTitle', label: 'Job Title', optional: true }
  ],
  defaultValues: {},
  statusOptions: (t) => [
    { value: 'Active', label: 'Active' },
    { value: 'Inactive', label: 'Inactive' }
  ]
}))

// Mock components
vi.mock('@/components/BCForm', () => ({
  BCFormRadio: ({ name, label, options }) => (
    <div data-test={`form-radio-${name}`}>
      <label>{label}</label>
      {options?.map((option, index) => (
        <input key={index} type="radio" value={option.value} />
      ))}
    </div>
  ),
  BCFormText: ({ name, label }) => (
    <div data-test={`form-text-${name}`}>
      <label>{label}</label>
      <input name={name} />
    </div>
  )
}))

vi.mock('./components/IDIRSpecificRoleFields', () => ({
  IDIRSpecificRoleFields: ({ form, disabled, t }) => (
    <div data-test="idir-role-fields">IDIR Role Fields</div>
  )
}))

vi.mock('./components/BCeIDSpecificRoleFields', () => ({
  BCeIDSpecificRoleFields: ({ form, disabled, status, t }) => (
    <div data-test="bceid-role-fields">BCeID Role Fields</div>
  )
}))

vi.mock('@/components/Loading', () => ({
  default: ({ message }) => <div data-test="loading">{message}</div>
}))

// Mock constants
vi.mock('@/constants/roles', () => ({
  roles: {
    supplier: 'supplier',
    government: 'government',
    administrator: 'administrator',
    read_only: 'read_only'
  }
}))

describe('AddEditUser', () => {
  const mockNavigate = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()

    // Mock router hooks
    mockUseNavigate.mockReturnValue(mockNavigate)
    mockUseParams.mockReturnValue({
      userID: undefined,
      orgID: undefined
    })

    // Mock watch to return default values
    mockWatch.mockImplementation((field) => {
      const defaults = {
        status: 'Active',
        readOnly: '',
        bceidRoles: []
      }
      return defaults[field] || ''
    })

    // Mock useCurrentUser
    vi.mocked(useCurrentUser).mockReturnValue({
      data: {
        organizationId: 'org123',
        organization: { organizationId: 'org123' },
        isGovernmentUser: true
      },
      hasRoles: vi.fn(() => false),
      isLoading: false
    })

    // Mock useUser
    vi.mocked(useUser).mockReturnValue({
      data: null,
      isLoading: false,
      isFetched: false
    })

    // Mock useOrganizationUser
    vi.mocked(useOrganizationUser).mockReturnValue({
      data: null,
      isLoading: false,
      isFetched: false
    })

    // Mock useDeleteUser
    vi.mocked(useDeleteUser).mockReturnValue({
      mutate: vi.fn()
    })
  })

  it('renders add user form with IDIR fields by default', () => {
    render(<AddEditUser />, { wrapper })

    expect(screen.getByText('Add user')).toBeInTheDocument()
    expect(screen.getByTestId('form-text-firstName')).toBeInTheDocument()
    expect(screen.getByTestId('form-text-lastName')).toBeInTheDocument()
    expect(screen.getByTestId('form-text-keycloakEmail')).toBeInTheDocument()
    expect(screen.getByTestId('form-radio-status')).toBeInTheDocument()
    expect(screen.getByTestId('idir-role-fields')).toBeInTheDocument()
  })

  it('renders add user form with BCeID fields when userType is bceid', () => {
    render(<AddEditUser userType="bceid" />, { wrapper })

    expect(screen.getByText('Add user')).toBeInTheDocument()
    expect(screen.getByTestId('form-text-firstName')).toBeInTheDocument()
    expect(screen.getByTestId('form-text-lastName')).toBeInTheDocument()
    expect(screen.getByTestId('form-text-keycloakEmail')).toBeInTheDocument()
    expect(screen.getByTestId('form-text-jobTitle')).toBeInTheDocument()
    expect(screen.getByTestId('bceid-role-fields')).toBeInTheDocument()
  })

  it('shows loading when user data is loading', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: null,
      hasRoles: vi.fn(() => false),
      isLoading: true
    })

    render(<AddEditUser />, { wrapper })
    expect(screen.getByTestId('loading')).toBeInTheDocument()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows loading when mutation is pending', () => {
    const { useMutation } = require('@tanstack/react-query')
    useMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
      isError: false
    })

    render(<AddEditUser />, { wrapper })
    expect(screen.getByTestId('loading')).toBeInTheDocument()
    expect(screen.getByText('Adding user...')).toBeInTheDocument()
  })

  it('shows error alert when mutation fails', () => {
    const { useMutation } = require('@tanstack/react-query')
    useMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: true
    })

    render(<AddEditUser />, { wrapper })
    expect(screen.getByText('common:submitError')).toBeInTheDocument()
  })

  it('renders edit user form when userID is provided', () => {
    mockUseParams.mockReturnValue({
      userID: 'user123',
      orgID: undefined
    })

    vi.mocked(useUser).mockReturnValue({
      data: {
        userProfileId: 'user123',
        firstName: 'John',
        lastName: 'Doe',
        keycloakEmail: 'john@example.com',
        isActive: true,
        isGovernmentUser: true,
        isSafeToRemove: true,
        roles: [{ name: 'government' }]
      },
      isLoading: false,
      isFetched: true
    })

    render(<AddEditUser />, { wrapper })
    expect(screen.getByText('Edit user')).toBeInTheDocument()
  })

  it('handles back button click for IDIR users', () => {
    render(<AddEditUser userType="idir" />, { wrapper })

    const backButton = screen.getByTestId('back-btn')
    fireEvent.click(backButton)

    expect(mockNavigate).toHaveBeenCalledWith('/admin/users')
  })

  it('handles back button click for BCeID users', () => {
    render(<AddEditUser userType="bceid" />, { wrapper })

    const backButton = screen.getByTestId('back-btn')
    fireEvent.click(backButton)

    expect(mockNavigate).toHaveBeenCalledWith('/organizations')
  })

  it('handles back button click for supplier users', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: {
        organizationId: 'org123',
        organization: { organizationId: 'org123' },
        isGovernmentUser: false
      },
      hasRoles: vi.fn(() => true),
      isLoading: false
    })

    render(<AddEditUser />, { wrapper })

    const backButton = screen.getByTestId('back-btn')
    fireEvent.click(backButton)

    expect(mockNavigate).toHaveBeenCalledWith('/organization')
  })

  it('shows delete button for BCeID users when safe to delete', () => {
    mockUseParams.mockReturnValue({
      userID: 'user123',
      orgID: 'org456'
    })

    vi.mocked(useOrganizationUser).mockReturnValue({
      data: {
        userProfileId: 'user123',
        firstName: 'John',
        lastName: 'Doe',
        isGovernmentUser: false,
        isSafeToRemove: true,
        organization: { organizationId: 'org456' },
        roles: [{ name: 'supplier' }]
      },
      isLoading: false,
      isFetched: true
    })

    render(<AddEditUser userType="bceid" />, { wrapper })
    expect(screen.getByTestId('delete-user-btn')).toBeInTheDocument()
  })

  it('shows disabled delete button when not safe to delete', () => {
    mockUseParams.mockReturnValue({
      userID: 'user123',
      orgID: 'org456'
    })

    vi.mocked(useOrganizationUser).mockReturnValue({
      data: {
        userProfileId: 'user123',
        firstName: 'John',
        lastName: 'Doe',
        isGovernmentUser: false,
        isSafeToRemove: false,
        organization: { organizationId: 'org456' },
        roles: [{ name: 'supplier' }]
      },
      isLoading: false,
      isFetched: true
    })

    render(<AddEditUser userType="bceid" />, { wrapper })

    const deleteButton = screen.getByTestId('delete-user-btn')
    expect(deleteButton).toBeInTheDocument()
    expect(deleteButton).toBeDisabled()
  })

  it('does not show delete button for government users', () => {
    mockUseParams.mockReturnValue({
      userID: 'user123',
      orgID: undefined
    })

    vi.mocked(useUser).mockReturnValue({
      data: {
        userProfileId: 'user123',
        firstName: 'John',
        lastName: 'Doe',
        isGovernmentUser: true,
        isSafeToRemove: true,
        roles: [{ name: 'government' }]
      },
      isLoading: false,
      isFetched: true
    })

    render(<AddEditUser />, { wrapper })
    expect(screen.queryByTestId('delete-user-btn')).not.toBeInTheDocument()
  })

  it('opens confirmation dialog when delete button is clicked', async () => {
    mockUseParams.mockReturnValue({
      userID: 'user123',
      orgID: 'org456'
    })

    vi.mocked(useOrganizationUser).mockReturnValue({
      data: {
        userProfileId: 'user123',
        firstName: 'John',
        lastName: 'Doe',
        isGovernmentUser: false,
        isSafeToRemove: true,
        organization: { organizationId: 'org456' },
        roles: [{ name: 'supplier' }]
      },
      isLoading: false,
      isFetched: true
    })

    render(<AddEditUser userType="bceid" />, { wrapper })

    const deleteButton = screen.getByTestId('delete-user-btn')
    fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(
        screen.getByText('admin:deleteUser.confirmTitle')
      ).toBeInTheDocument()
      expect(
        screen.getByText('admin:deleteUser.confirmMessage')
      ).toBeInTheDocument()
    })
  })

  it('handles form submission', async () => {
    const mockMutate = vi.fn()
    const { useMutation } = require('@tanstack/react-query')
    useMutation.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: false
    })

    mockHandleSubmit.mockImplementation((onSubmit) => (e) => {
      e.preventDefault()
      onSubmit({
        firstName: 'John',
        lastName: 'Doe',
        keycloakEmail: 'john@example.com',
        status: 'Active',
        adminRole: [],
        bceidRoles: [],
        readOnly: '',
        idirRole: ''
      })
    })

    render(<AddEditUser />, { wrapper })

    const form =
      screen.getByRole('form') ||
      screen.getByTestId('form-provider').parentElement
    fireEvent.submit(form)

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalled()
    })
  })

  it('displays organization name for BCeID users', () => {
    mockUseParams.mockReturnValue({
      userID: 'user123',
      orgID: 'org456'
    })

    vi.mocked(useOrganizationUser).mockReturnValue({
      data: {
        userProfileId: 'user123',
        firstName: 'John',
        lastName: 'Doe',
        organization: { name: 'Test Organization' },
        roles: [{ name: 'supplier' }]
      },
      isLoading: false,
      isFetched: true
    })

    render(<AddEditUser userType="bceid" />, { wrapper })
    expect(
      screen.getByText('Edit user to Test Organization')
    ).toBeInTheDocument()
  })

  it('handles status change effects', () => {
    mockWatch.mockImplementation((field) => {
      if (field === 'status') return 'Inactive'
      return ''
    })

    render(<AddEditUser />, { wrapper })
    // Component should render without errors when status is Inactive
    expect(screen.getByTestId('form-radio-status')).toBeInTheDocument()
  })

  it('handles readOnly role effects', () => {
    mockWatch.mockImplementation((field) => {
      if (field === 'readOnly') return 'read_only'
      return field === 'bceidRoles' ? [] : ''
    })

    render(<AddEditUser />, { wrapper })
    // Component should render and setValue should be called for bceidRoles
    expect(mockSetValue).toHaveBeenCalledWith('bceidRoles', [])
  })

  it('handles bceidRoles effects', () => {
    mockWatch.mockImplementation((field) => {
      if (field === 'bceidRoles') return ['some_role']
      return ''
    })

    render(<AddEditUser />, { wrapper })
    // Component should render and setValue should be called for readOnly
    expect(mockSetValue).toHaveBeenCalledWith('readOnly', '')
  })

  it('handles supplier user context', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: {
        organizationId: 'org123',
        organization: { organizationId: 'org123' },
        isGovernmentUser: false
      },
      hasRoles: vi.fn(() => true),
      isLoading: false
    })

    render(<AddEditUser />, { wrapper })
    expect(screen.getByTestId('bceid-role-fields')).toBeInTheDocument()
  })

  it('populates form with user data when editing', () => {
    mockUseParams.mockReturnValue({
      userID: 'user123',
      orgID: undefined
    })

    vi.mocked(useUser).mockReturnValue({
      data: {
        userProfileId: 'user123',
        firstName: 'John',
        lastName: 'Doe',
        keycloakEmail: 'john@example.com',
        keycloakUsername: 'johndoe',
        title: 'Developer',
        phone: '123-456-7890',
        mobilePhone: '098-765-4321',
        isActive: true,
        isGovernmentUser: true,
        roles: [{ name: 'government' }, { name: 'administrator' }]
      },
      isLoading: false,
      isFetched: true
    })

    render(<AddEditUser />, { wrapper })

    expect(mockReset).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'John',
        lastName: 'Doe',
        keycloakEmail: 'john@example.com',
        status: 'Active'
      })
    )
  })

  it('confirms user deletion', async () => {
    const mockDeleteMutate = vi.fn()
    vi.mocked(useDeleteUser).mockReturnValue({
      mutate: mockDeleteMutate
    })

    mockUseParams.mockReturnValue({
      userID: 'user123',
      orgID: 'org456'
    })

    vi.mocked(useOrganizationUser).mockReturnValue({
      data: {
        userProfileId: 'user123',
        isGovernmentUser: false,
        isSafeToRemove: true,
        organization: { organizationId: 'org456' },
        roles: [{ name: 'supplier' }]
      },
      isLoading: false,
      isFetched: true
    })

    render(<AddEditUser userType="bceid" />, { wrapper })

    // Click delete button to open dialog
    const deleteButton = screen.getByTestId('delete-user-btn')
    fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(
        screen.getByText('admin:deleteUser.confirmTitle')
      ).toBeInTheDocument()
    })

    // Find and click confirm button
    const confirmButton = screen.getByRole('button', {
      name: 'admin:deleteUser.button'
    })
    fireEvent.click(confirmButton)

    expect(mockDeleteMutate).toHaveBeenCalledWith('user123', expect.any(Object))
  })

  it('cancels user deletion', async () => {
    mockUseParams.mockReturnValue({
      userID: 'user123',
      orgID: 'org456'
    })

    vi.mocked(useOrganizationUser).mockReturnValue({
      data: {
        userProfileId: 'user123',
        isGovernmentUser: false,
        isSafeToRemove: true,
        organization: { organizationId: 'org456' },
        roles: [{ name: 'supplier' }]
      },
      isLoading: false,
      isFetched: true
    })

    render(<AddEditUser userType="bceid" />, { wrapper })

    // Click delete button to open dialog
    const deleteButton = screen.getByTestId('delete-user-btn')
    fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(
        screen.getByText('admin:deleteUser.confirmTitle')
      ).toBeInTheDocument()
    })

    // Find and click cancel button
    const cancelButton = screen.getByText('cancelBtn')
    fireEvent.click(cancelButton)

    await waitFor(() => {
      expect(
        screen.queryByText('admin:deleteUser.confirmTitle')
      ).not.toBeInTheDocument()
    })
  })
})
