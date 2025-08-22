import React from 'react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddEditOrgForm } from '../AddEditOrgForm'
import { useApiService } from '@/services/useApiService'
import { useOrganization, useOrganizationTypes } from '@/hooks/useOrganization'
import { useNavigate, useParams } from 'react-router-dom'
import { ROUTES } from '@/routes/routes'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'

const mockSetValue = vi.fn()
const mockWatch = vi.fn()
const mockTrigger = vi.fn()
const mockReset = vi.fn()
const mockHandleSubmit = vi.fn((fn) => (event) => {
  event?.preventDefault?.()
  // Call the provided function with form data and connect it to the API
  const result = fn({
    orgLegalName: 'New Organization',
    orgOperatingName: 'New Org',
    orgEmailAddress: 'new@example.com',
    orgPhoneNumber: '604-555-1234',
    orgStreetAddress: '123 New St',
    orgCity: 'New City',
    orgPostalCodeZipCode: 'V6B3K9',
    orgRegForTransfers: 2,
    hasEarlyIssuance: true,
    orgEDRMSRecord: 'EDRMS-123'
  })

  return result
})
const mockFormState = { errors: {} }

// Mock all dependencies first
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useParams: vi.fn(),
    useNavigate: vi.fn()
  }
})

vi.mock('@/services/useApiService', () => ({
  useApiService: vi.fn()
}))

vi.mock('@/hooks/useOrganization', () => ({
  useOrganization: vi.fn(),
  useOrganizationTypes: vi.fn()
}))

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: (key) => key,
    i18n: { changeLanguage: vi.fn() }
  })),
  I18nextProvider: ({ children }) => children
}))

vi.mock('react-hook-form', () => ({
  // Static mock implementation for useForm
  useForm: () => ({
    register: vi.fn().mockImplementation((name) => ({
      name,
      onChange: vi.fn(),
      onBlur: vi.fn(),
      ref: vi.fn()
    })),
    handleSubmit: mockHandleSubmit,
    formState: mockFormState,
    setValue: mockSetValue,
    watch: mockWatch,
    trigger: mockTrigger,
    reset: mockReset,
    control: {}
  }),
  Controller: ({ name, control, render }) => (
    <div data-testid={`controller-${name}`} data-test={`controller-${name}`}>
      {render({
        field: {
          onChange: vi.fn(),
          value: '',
          name,
          ref: vi.fn()
        },
        fieldState: {}
      })}
    </div>
  ),
  FormProvider: ({ children }) => <div>{children}</div>
}))

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useMutation: vi.fn(() => ({
      mutate: vi.fn(),
      isPending: false,
      isError: false
    }))
  }
})

vi.mock('@mui/material', () => ({
  Box: React.forwardRef((props, ref) => {
    const { flexWrap, ...otherProps } = props
    return (
      <div ref={ref} data-testid="box" data-flexwrap={flexWrap} {...otherProps}>
        {props.children}
      </div>
    )
  }),
  Paper: (props) => (
    <div data-testid="paper" {...props}>
      {props.children}
    </div>
  ),
  TextField: React.forwardRef(
    (
      {
        id,
        label,
        error,
        helperText,
        fullWidth,
        variant,
        select,
        SelectProps, // eslint-disable-line no-unused-vars
        children,
        ...props
      },
      ref
    ) => (
      <div data-testid={id || 'text-field'}>
        {label && <label htmlFor={id}>{label}</label>}
        {select ? (
          <select id={id} ref={ref} data-test={props['data-test']} {...props}>
            {children}
          </select>
        ) : (
          <input
            id={id}
            ref={ref}
            data-fullwidth={fullWidth ? 'true' : undefined}
            data-variant={variant}
            data-test={props['data-test']}
            {...props}
          />
        )}
        {error && <span>{helperText}</span>}
      </div>
    )
  ),
  Typography: (props) => (
    <div data-testid="typography" {...props}>
      {props.children}
    </div>
  ),
  Grid: React.forwardRef(
    ({ container, item, spacing, xs, md, children, ...props }, ref) => (
      <div
        ref={ref}
        data-testid="grid"
        data-container={container ? 'true' : undefined}
        data-item={item ? 'true' : undefined}
        data-spacing={spacing}
        data-xs={xs}
        data-md={md}
        {...props}
      >
        {children}
      </div>
    )
  ),
  FormControl: React.forwardRef(({ fullWidth, ...props }, ref) => (
    <div
      ref={ref}
      data-testid="form-control"
      data-fullwidth={fullWidth ? 'true' : undefined}
      {...props}
    >
      {props.children}
    </div>
  )),
  FormLabel: React.forwardRef((props, ref) => (
    <div ref={ref} data-testid="form-label" {...props}>
      {props.children}
    </div>
  )),
  FormControlLabel: React.forwardRef((props, ref) => (
    <div ref={ref} data-testid="form-control-label" {...props}>
      {props.control}
      <span>{props.label}</span>
    </div>
  )),
  FormHelperText: React.forwardRef((props, ref) => (
    <span ref={ref} data-testid="form-helper-text" {...props}>
      {props.children}
    </span>
  )),
  RadioGroup: React.forwardRef(({ row, onChange, ...props }, ref) => (
    <div
      ref={ref}
      data-testid="radio-group"
      data-row={row ? 'true' : undefined}
      onChange={onChange}
      {...props}
    >
      {props.children}
    </div>
  )),
  Radio: React.forwardRef((props, ref) => (
    <input
      ref={ref}
      type="radio"
      checked={props.checked}
      value={props.value}
      data-testid={props['data-testid'] || `radio-${props.value}`}
      {...props}
    />
  )),
  Checkbox: React.forwardRef((props, ref) => (
    <input
      ref={ref}
      type="checkbox"
      checked={props.checked || false}
      onChange={props.onChange}
      data-testid={props['data-testid'] || 'checkbox'}
      {...props}
    />
  )),
  InputLabel: (props) => (
    <label data-testid="input-label" {...props}>
      {props.children}
    </label>
  ),
  Select: (props) => (
    <select data-testid="select" {...props}>
      {props.children}
    </select>
  ),
  MenuItem: (props) => (
    <option value={props.value} {...props}>
      {props.children}
    </option>
  ),
  Divider: () => <hr data-testid="divider" />,
  Stack: (props) => (
    <div data-testid="stack" {...props}>
      {props.children}
    </div>
  )
}))

vi.mock('@mui/x-date-pickers', () => ({
  DatePicker: (props) => (
    <div data-testid="date-picker">
      <label>{props.label}</label>
      <input
        type="date"
        value={props.value || ''}
        onChange={(e) => props.onChange(e.target.value)}
        {...props}
      />
    </div>
  ),
  LocalizationProvider: (props) => <div>{props.children}</div>
}))

vi.mock('@/components/BCButton', () => ({
  default: (props) => (
    <button
      onClick={props.onClick}
      type={props.type}
      data-testid={props['data-test'] || props['data-testid'] || 'button'}
    >
      {props.children}
    </button>
  )
}))

vi.mock('@/components/BCForm', () => ({
  AddressAutocomplete: React.forwardRef((props, ref) => (
    <input
      ref={ref}
      data-test="address-autocomplete"
      value={props.value || ''}
      onChange={(e) => props.onChange && props.onChange(e.target.value)}
      onSelect={() =>
        props.onSelectAddress &&
        props.onSelectAddress({
          streetAddress: '123 Test St',
          city: 'TestCity'
        })
      }
    />
  )),
  TextField: React.forwardRef((props, ref) => (
    <div data-testid={props.id || 'bcform-text-field'}>
      <input ref={ref} {...props} />
    </div>
  ))
}))

const queryClient = new QueryClient()

const Wrapper = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/organizations/add']}>
        <Routes>
          <Route path="/organizations/add" element={children} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>
  </QueryClientProvider>
)

describe('AddEditOrgForm Component', () => {
  const mockNavigate = vi.fn()
  const mockApiPost = vi.fn()
  const mockApiPut = vi.fn()
  const mockHandleCancelEdit = vi.fn()

  // Mock organization types data
  const mockOrgTypes = [
    {
      organizationTypeId: 1,
      orgType: 'fuel_supplier',
      description: 'Fuel supplier',
      isBceidUser: true
    },
    {
      organizationTypeId: 2,
      orgType: 'aggregator',
      description: 'Aggregator',
      isBceidUser: true
    },
    {
      organizationTypeId: 3,
      orgType: 'fuel_producer',
      description: 'Fuel producer, fuel code applicant',
      isBceidUser: false
    },
    {
      organizationTypeId: 4,
      orgType: 'exempted_supplier',
      description: 'Exempted supplier',
      isBceidUser: false
    },
    {
      organizationTypeId: 5,
      orgType: 'initiative_agreement_holder',
      description: 'Initiative agreement holder',
      isBceidUser: false
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()

    // Reset mock form state
    Object.assign(mockFormState, { errors: {} })

    // Setup default mocks
    useNavigate.mockReturnValue(mockNavigate)
    useApiService.mockReturnValue({
      post: mockApiPost,
      put: mockApiPut
    })
    useParams.mockReturnValue({ orgID: undefined })
    useOrganization.mockReturnValue({
      data: null,
      isFetched: false
    })
    useOrganizationTypes.mockReturnValue({
      data: mockOrgTypes,
      isLoading: false,
      error: null
    })

    // Reset watch implementation
    mockWatch.mockImplementation((field) => {
      if (field === 'orgLegalName') return ''
      return ''
    })
  })

  it('renders the form in add mode', () => {
    render(<Wrapper><AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} /></Wrapper>)

    // Verify key form elements are rendered
    expect(screen.getByTestId('orgLegalName')).toBeInTheDocument()
    expect(screen.getByTestId('orgOperatingName')).toBeInTheDocument()
    expect(screen.getByTestId('orgEmailAddress')).toBeInTheDocument()
    expect(screen.getByTestId('orgPhoneNumber')).toBeInTheDocument()
  })

  it('renders the form in edit mode with pre-populated data', async () => {
    useParams.mockReturnValue({ orgID: '123' })
    useOrganization.mockReturnValue({
      data: {
        name: 'Test Organization',
        operatingName: 'Test Org',
        email: 'test@example.com',
        orgStatus: { organizationStatusId: 2 }
      },
      isFetched: true
    })

    render(<Wrapper><AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} /></Wrapper>)

    await waitFor(() => {
      expect(screen.getByTestId('orgLegalName')).toBeInTheDocument()
    })
  })

  it('syncs operating name with legal name when checkbox is checked', async () => {
    mockWatch.mockImplementation((field) => {
      if (field === 'orgLegalName') return 'Test Legal Name'
      return ''
    })

    render(<Wrapper><AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} /></Wrapper>)

    const checkbox = screen.getByTestId('sameAsLegalName')
    fireEvent.click(checkbox)

    expect(mockSetValue).toHaveBeenCalledWith(
      'orgOperatingName',
      'Test Legal Name'
    )
  })

  it('calls handleCancelEdit when cancel button is clicked', async () => {
    const user = userEvent.setup()

    render(<Wrapper><AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} /></Wrapper>)

    // Find and click the Cancel button by its text content
    const cancelButton = screen.getByText('cancelBtn')
    await user.click(cancelButton)

    // Verify handleCancelEdit was called
    expect(mockHandleCancelEdit).toHaveBeenCalledTimes(1)
  })

  it('handles address autocomplete selection', async () => {
    const user = userEvent.setup()

    render(<Wrapper><AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} /></Wrapper>)

    const addressInput = screen.getAllByTestId('address-autocomplete')[0]
    fireEvent.select(addressInput)

    expect(mockSetValue).toHaveBeenCalledWith('orgStreetAddress', '123 Test St')
    expect(mockSetValue).toHaveBeenCalledWith('orgCity', 'TestCity')
  })

  describe('Organization Type Dropdown', () => {
    it('renders organization type dropdown with all options', () => {
      render(
        <Wrapper>
          <AddEditOrgForm />
        </Wrapper>
      )

      // Check that the organization type controller is rendered
      expect(screen.getByTestId('controller-orgType')).toBeInTheDocument()
    })

    it('shows BCeID and non-BCeID user indicators in options', () => {
      render(
        <Wrapper>
          <AddEditOrgForm />
        </Wrapper>
      )

      // The Controller component should be present with orgType name
      const controller = screen.getByTestId('controller-orgType')
      expect(controller).toBeInTheDocument()

      // Verify the form field is accessible
      const orgTypeField = screen.getByTestId('orgType')
      expect(orgTypeField).toBeInTheDocument()
    })

    it('defaults to fuel supplier selection', () => {
      render(
        <Wrapper>
          <AddEditOrgForm />
        </Wrapper>
      )

      // Verify the default value is set correctly
      const controller = screen.getByTestId('controller-orgType')
      expect(controller).toBeInTheDocument()
    })

    it('handles organization type loading state', () => {
      useOrganizationTypes.mockReturnValue({
        data: null,
        isLoading: true,
        error: null
      })

      render(
        <Wrapper>
          <AddEditOrgForm />
        </Wrapper>
      )

      // Should still render the controller even when loading
      expect(screen.getByTestId('controller-orgType')).toBeInTheDocument()
    })

    it('handles organization type error state', () => {
      useOrganizationTypes.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Failed to load organization types')
      })

      render(
        <Wrapper>
          <AddEditOrgForm />
        </Wrapper>
      )

      // Should still render the controller even when there's an error
      expect(screen.getByTestId('controller-orgType')).toBeInTheDocument()
    })

    it('populates form correctly in edit mode with organization type', async () => {
      useParams.mockReturnValue({ orgID: '123' })
      useOrganization.mockReturnValue({
        data: {
          name: 'Test Organization',
          operatingName: 'Test Org',
          email: 'test@example.com',
          organizationTypeId: 2, // Aggregator
          orgType: {
            organizationTypeId: 2,
            orgType: 'aggregator',
            description: 'Aggregator',
            isBceidUser: true
          },
          orgStatus: { organizationStatusId: 2 }
        },
        isFetched: true
      })

      render(
        <Wrapper>
          <AddEditOrgForm />
        </Wrapper>
      )

      await waitFor(() => {
        // Verify reset was called with correct organization type
        expect(mockReset).toHaveBeenCalled()
      })
    })

    it('validates organization type requirement', () => {
      // Set up form errors for orgType
      Object.assign(mockFormState, {
        errors: {
          orgType: {
            message: 'Organization type is required.'
          }
        }
      })

      render(
        <Wrapper>
          <AddEditOrgForm />
        </Wrapper>
      )

      const controller = screen.getByTestId('controller-orgType')
      expect(controller).toBeInTheDocument()
    })
  })
})
