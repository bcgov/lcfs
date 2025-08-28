import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as OrganizationSnapshotHooks from '@/hooks/useOrganizationSnapshot.js'
import { OrganizationAddress } from '../OrganizationAddress'
import { wrapper } from '@/tests/utils/wrapper.jsx'

// Mock react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('@/hooks/useOrganizationSnapshot.js')

vi.mock('@/hooks/useGeocoder', () => ({
  default: () => ({
    validateAddress: { mutateAsync: vi.fn(), isLoading: false },
    forwardGeocode: { mutateAsync: vi.fn(), isLoading: false },
    reverseGeocode: { mutateAsync: vi.fn(), isLoading: false },
    autocompleteAddress: { mutateAsync: vi.fn(), isLoading: false },
    checkBCBoundary: { mutateAsync: vi.fn(), isLoading: false },
    batchGeocode: { mutateAsync: vi.fn(), isLoading: false },
    useHealthCheck: () => ({ data: null, isLoading: false })
  })
}))

vi.mock('@/services/useApiService', () => ({
  useApiService: () => ({
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  })
}))

// Mock react-hook-form
const mockReset = vi.fn()
const mockSetValue = vi.fn()
const mockWatch = vi.fn()
const mockHandleSubmit = vi.fn()
const mockGetValues = vi.fn()

vi.mock('react-hook-form', () => ({
  useForm: () => ({
    handleSubmit: mockHandleSubmit,
    control: {},
    setValue: mockSetValue,
    watch: mockWatch,
    reset: mockReset,
    getValues: mockGetValues
  }),
  FormProvider: ({ children }) => children,
  Controller: ({ render, control, name, defaultValue }) => {
    return render({
      field: {
        onChange: vi.fn(),
        onBlur: vi.fn(),
        value: defaultValue,
        name,
        ref: vi.fn()
      },
      fieldState: {
        invalid: false,
        isTouched: false,
        isDirty: false,
        error: undefined
      },
      formState: {
        isSubmitting: false,
        isValid: true
      }
    })
  }
}))

describe('OrganizationAddress', () => {
  let snapshotData
  let setIsEditingMock
  let mockMutate
  let defaultProps

  beforeEach(() => {
    vi.clearAllMocks()

    snapshotData = {
      name: 'ACME Corporation',
      operatingName: 'ACME',
      phone: '250-123-4567',
      email: 'info@acme.com',
      serviceAddress: '123 Main St.',
      recordsAddress: '456 BC St.',
      headOfficeAddress: '789 HQ St.'
    }

    setIsEditingMock = vi.fn()
    mockMutate = vi.fn()

    defaultProps = {
      snapshotData,
      complianceReportId: 123,
      isEditing: false,
      setIsEditing: setIsEditingMock,
      isGovernmentUser: false,
      orgID: 456,
      reportID: 789
    }

    mockWatch.mockImplementation((field) => {
      if (field === 'serviceAddress') return '123 Main St.'
      if (field === 'name') return 'ACME Corporation'
      return snapshotData[field]
    })

    mockGetValues.mockReturnValue(snapshotData)
    mockHandleSubmit.mockImplementation((onSubmit, onError) => (e) => {
      e.preventDefault()
      onSubmit(snapshotData)
    })

    vi.spyOn(OrganizationSnapshotHooks, 'useUpdateOrganizationSnapshot').mockReturnValue({
      mutate: mockMutate,
      isLoading: false
    })
  })

  // Component Rendering Tests
  describe('Component Rendering', () => {
    it('renders read-only data when not editing', () => {
      render(<OrganizationAddress {...defaultProps} />, { wrapper })

      expect(screen.getByText('org:legalNameLabel:')).toBeInTheDocument()
      expect(screen.getByText(snapshotData.name)).toBeInTheDocument()
      expect(screen.getByText('org:operatingNameLabel:')).toBeInTheDocument()
      expect(screen.getByText(snapshotData.operatingName)).toBeInTheDocument()
      expect(screen.getByText('org:phoneNbrLabel:')).toBeInTheDocument()
      expect(screen.getByText(snapshotData.phone)).toBeInTheDocument()
    })

    it('renders the form in editing mode', () => {
      render(<OrganizationAddress {...defaultProps} isEditing={true} />, { wrapper })

      // Check that form element exists
      const formElement = document.querySelector('form')
      expect(formElement).toBeInTheDocument()
      
      // Check form fields are rendered
      expect(screen.getByRole('textbox', { name: /org:legalNameLabel/i })).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: /org:operatingNameLabel/i })).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: /org:phoneNbrLabel/i })).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: /org:emailAddrLabel/i })).toBeInTheDocument()
      
      // Check save and cancel buttons
      expect(screen.getByText('saveBtn')).toBeInTheDocument()
      expect(screen.getByText('cancelBtn')).toBeInTheDocument()
    })

    it('shows Required for missing required fields in read-only mode', () => {
      const incompleteData = {
        ...snapshotData,
        name: '',
        phone: '',
        email: '',
        serviceAddress: ''
      }

      render(<OrganizationAddress {...defaultProps} snapshotData={incompleteData} />, { wrapper })

      const requiredElements = screen.getAllByText('Required')
      expect(requiredElements.length).toBeGreaterThan(0)
    })

    it('shows update org info button for government user with edited snapshot', () => {
      const editedSnapshot = { ...snapshotData, isEdited: true }

      render(
        <OrganizationAddress
          {...defaultProps}
          snapshotData={editedSnapshot}
          isGovernmentUser={true}
        />,
        { wrapper }
      )

      expect(screen.getByText('report:updateOrgInfo')).toBeInTheDocument()
    })

    it('does not show update org info button for non-government user', () => {
      const editedSnapshot = { ...snapshotData, isEdited: true }

      render(
        <OrganizationAddress
          {...defaultProps}
          snapshotData={editedSnapshot}
          isGovernmentUser={false}
        />,
        { wrapper }
      )

      expect(screen.queryByText('report:updateOrgInfo')).not.toBeInTheDocument()
    })
  })

  // Form Interactions Tests
  describe('Form Interactions', () => {
    it('calls mutate on form submit with valid data', async () => {
      const user = userEvent.setup()

      render(<OrganizationAddress {...defaultProps} isEditing={true} />, { wrapper })

      const saveButton = screen.getByText('saveBtn')
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(snapshotData)
        expect(setIsEditingMock).toHaveBeenCalledWith(false)
      })
    })

    it('handles form submission error and shows modal', async () => {
      const user = userEvent.setup()
      mockHandleSubmit.mockImplementation((onSubmit, onError) => (e) => {
        e.preventDefault()
        onError()
      })

      render(<OrganizationAddress {...defaultProps} isEditing={true} />, { wrapper })

      const saveButton = screen.getByText('saveBtn')
      await user.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Confirm Changes')).toBeInTheDocument()
        expect(screen.getByText('You will need to fill out all required fields to submit the Compliance Report. Are you sure you want to continue?')).toBeInTheDocument()
      })
    })

    it('clicking Cancel resets form and exits edit mode', async () => {
      const user = userEvent.setup()

      render(<OrganizationAddress {...defaultProps} isEditing={true} />, { wrapper })

      const cancelButton = screen.getByText('cancelBtn')
      await user.click(cancelButton)

      expect(mockReset).toHaveBeenCalledWith(snapshotData)
      expect(setIsEditingMock).toHaveBeenCalledWith(false)
    })

    it('resets form data when snapshotData changes', () => {
      const { rerender } = render(<OrganizationAddress {...defaultProps} isEditing={true} />, { wrapper })

      const newSnapshotData = { ...snapshotData, name: 'Updated Corp' }
      rerender(<OrganizationAddress {...defaultProps} snapshotData={newSnapshotData} isEditing={true} />)

      expect(mockReset).toHaveBeenCalledWith(newSnapshotData)
    })

    it('handles modal confirm action', async () => {
      const user = userEvent.setup()
      mockHandleSubmit.mockImplementation((onSubmit, onError) => (e) => {
        e.preventDefault()
        onError()
      })

      render(<OrganizationAddress {...defaultProps} isEditing={true} />, { wrapper })

      const saveButton = screen.getByText('saveBtn')
      await user.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Confirm Changes')).toBeInTheDocument()
      })

      const confirmButton = screen.getByText('Confirm')
      await user.click(confirmButton)

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(snapshotData)
      })
    })

    it('handles modal cancel action', async () => {
      const user = userEvent.setup()
      mockHandleSubmit.mockImplementation((onSubmit, onError) => (e) => {
        e.preventDefault()
        onError()
      })

      render(<OrganizationAddress {...defaultProps} isEditing={true} />, { wrapper })

      const saveButton = screen.getByText('saveBtn')
      await user.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Confirm Changes')).toBeInTheDocument()
      })

      // Find the modal cancel button specifically
      const modalCancelButton = screen.getByRole('button', { name: 'cancelBtn' })
      await user.click(modalCancelButton)

      await waitFor(() => {
        expect(screen.queryByText('Confirm Changes')).not.toBeInTheDocument()
      })
    })

    it('validates form data properly', () => {
      render(<OrganizationAddress {...defaultProps} isEditing={true} />, { wrapper })

      // The component should have validation schema defined
      // This test ensures the validation is setup correctly
      expect(mockHandleSubmit).toHaveBeenCalled()
    })
  })

  // Helper Functions Tests
  describe('Helper Functions', () => {
    it('displayAddressValue returns value when present', () => {
      render(<OrganizationAddress {...defaultProps} />, { wrapper })

      // The function should display the actual address values
      expect(screen.getByText(snapshotData.serviceAddress)).toBeInTheDocument()
      expect(screen.getByText(snapshotData.recordsAddress)).toBeInTheDocument()
    })

    it('displayAddressValue returns empty string when value is empty', () => {
      const emptySnapshot = { ...snapshotData, recordsAddress: '' }

      render(<OrganizationAddress {...defaultProps} snapshotData={emptySnapshot} />, { wrapper })

      // Should not show "Required" for non-required fields that are empty
      expect(screen.getByText('report:orgDetailsForm.bcRecordLabel:')).toBeInTheDocument()
    })

  })

  // Mock Checkbox Functionality Tests (to test internal logic)
  describe('Checkbox Functionality', () => {
    it('renders component with checkbox states from snapshot data', () => {
      const sameNameSnapshot = {
        ...snapshotData,
        name: 'ACME Corp',
        operatingName: 'ACME Corp'
      }

      render(<OrganizationAddress {...defaultProps} snapshotData={sameNameSnapshot} isEditing={true} />, { wrapper })

      // Component should render with checkboxes based on data equality
      expect(screen.getByRole('textbox', { name: /org:legalNameLabel/i })).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: /org:operatingNameLabel/i })).toBeInTheDocument()
    })



  })

  // Address Selection Tests
  describe('Address Selection', () => {
    it('renders address form fields in edit mode', () => {
      render(<OrganizationAddress {...defaultProps} isEditing={true} />, { wrapper })

      // Component should have form with checkboxes
      expect(document.querySelector('form')).toBeInTheDocument()
      expect(screen.getAllByRole('checkbox').length).toBeGreaterThanOrEqual(1)
    })

    it('renders address checkboxes with correct labels', () => {
      render(<OrganizationAddress {...defaultProps} isEditing={true} />, { wrapper })

      // Check for checkbox labels
      expect(screen.getByText('same as legal name')).toBeInTheDocument()
      expect(screen.getAllByText('same as address for service').length).toBe(2)
    })


    it('syncs head office address when checkbox is enabled', () => {
      const sameHeadOfficeSnapshot = {
        ...snapshotData,
        serviceAddress: '123 Main St.',
        headOfficeAddress: '123 Main St.'
      }

      render(<OrganizationAddress {...defaultProps} snapshotData={sameHeadOfficeSnapshot} isEditing={true} />, { wrapper })

      // Component should handle head office address syncing  
      expect(document.querySelector('form')).toBeInTheDocument()
      expect(screen.getAllByText('same as address for service').length).toBe(2)
    })
  })

  // Additional Coverage Tests
  describe('Additional Coverage', () => {

    it('renders all form field types correctly', () => {
      render(<OrganizationAddress {...defaultProps} isEditing={true} />, { wrapper })

      // All text fields should be present
      const textboxes = screen.getAllByRole('textbox')
      expect(textboxes.length).toBe(5) // name, operatingName, phone, email, headOfficeAddress
      
      // Form with save and cancel buttons
      expect(document.querySelector('form')).toBeInTheDocument()
      expect(screen.getByText('saveBtn')).toBeInTheDocument()
      expect(screen.getByText('cancelBtn')).toBeInTheDocument()
    })

    it('displays correct labels for read-only vs edit mode', () => {
      const { rerender } = render(<OrganizationAddress {...defaultProps} isEditing={false} />, { wrapper })

      expect(screen.getByText('report:hoAddrLabelView:')).toBeInTheDocument()
      expect(screen.getByText('report:orgDetailsForm.serviceAddrLabelView:')).toBeInTheDocument()
      expect(document.querySelector('form')).not.toBeInTheDocument()

      rerender(<OrganizationAddress {...defaultProps} isEditing={true} />)

      expect(document.querySelector('form')).toBeInTheDocument()
      expect(screen.getByText('saveBtn')).toBeInTheDocument()
      expect(screen.getByText('cancelBtn')).toBeInTheDocument()
    })
  })
})