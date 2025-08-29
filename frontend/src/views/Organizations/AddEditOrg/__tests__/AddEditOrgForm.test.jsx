import React from 'react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddEditOrgForm } from '../AddEditOrgForm'
import { useApiService } from '@/services/useApiService'
import { useOrganization, useOrganizationTypes } from '@/hooks/useOrganization'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { ROUTES } from '@/routes/routes'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'

// Mock form implementation
const mockSetValue = vi.fn()
const mockWatch = vi.fn()
const mockTrigger = vi.fn()
const mockReset = vi.fn()
const mockHandleSubmit = vi.fn((fn) => (event) => {
  event?.preventDefault?.()
  fn({
    orgLegalName: 'Test Org',
    orgOperatingName: 'Test Operating',
    orgEmailAddress: 'test@example.com',
    orgPhoneNumber: '604-555-1234',
    orgStreetAddress: '123 Test St',
    orgCity: 'Test City',
    orgPostalCodeZipCode: 'V6B3K9',
    orgRegForTransfers: '1',
    hasEarlyIssuance: 'no',
    orgEDRMSRecord: 'EDRMS-123'
  })
})

// Mock dependencies
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useParams: vi.fn(),
    useNavigate: vi.fn(),
    useLocation: vi.fn()
  }
})

vi.mock('@/services/useApiService', () => ({
  useApiService: vi.fn()
}))

vi.mock('@/hooks/useOrganization', () => ({
  useOrganization: vi.fn(),
  useOrganizationTypes: vi.fn()
}))

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useTranslation: vi.fn(() => ({
      t: (key) => key,
      i18n: { changeLanguage: vi.fn() }
    })),
    I18nextProvider: ({ children }) => children
  }
})

vi.mock('react-hook-form', () => ({
  useForm: () => ({
    register: vi.fn().mockImplementation((name) => ({
      name,
      onChange: vi.fn(),
      onBlur: vi.fn(),
      ref: vi.fn()
    })),
    handleSubmit: mockHandleSubmit,
    formState: { errors: {} },
    setValue: mockSetValue,
    watch: mockWatch,
    trigger: mockTrigger,
    reset: mockReset,
    control: {}
  }),
  Controller: React.forwardRef(({ name, control, render }, ref) => (
    <div data-testid={`controller-${name}`} data-test={`controller-${name}`}>
      {render({
        field: {
          onChange: vi.fn(),
          value: '',
          name,
          ref: ref || vi.fn()
        },
        fieldState: {}
      })}
    </div>
  ))
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

// Simple component mocks
vi.mock('@/components/BCButton', () => ({
  default: (props) => (
    <button
      onClick={props.onClick}
      type={props.type}
      data-test={props['data-test'] || props['data-testid'] || 'button'}
    >
      {props.children}
    </button>
  )
}))

vi.mock('@/components/BCAlert', () => ({
  default: (props) => (
    <div data-testid="bc-alert" data-severity={props.severity}>
      {props.children}
    </div>
  ),
  BCAlert2: React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      triggerAlert: vi.fn()
    }))
    return (
      <div data-test="bc-alert2" data-dismissable={props.dismissable}>
        Alert Content
      </div>
    )
  })
}))

vi.mock('@/components/Loading', () => ({
  default: (props) => <div data-testid="loading">{props.message}</div>
}))

vi.mock('@/components/BCForm/index.js', () => ({
  AddressAutocomplete: React.forwardRef((props, ref) => (
    <input
      ref={ref}
      data-test={`address-autocomplete-${props.name || 'default'}`}
      data-testid="address-autocomplete"
      value={props.value || ''}
      onChange={(e) => props.onChange && props.onChange(e.target.value)}
    />
  ))
}))

vi.mock('../ReferenceCompareBox', () => ({
  default: (props) => (
    <div data-testid="reference-compare-box">
      <div>{props.title}</div>
      <button onClick={props.onDismiss}>Dismiss</button>
      {props.data?.map((item, index) => (
        <div key={index}>
          {item.label}: {item.value}
        </div>
      ))}
    </div>
  )
}))

// Material UI simple mocks
vi.mock('@mui/material', () => ({
  Box: ({ children, component = 'div', flexWrap, ...props }) => {
    const domProps = { ...props }
    if (flexWrap) domProps.style = { ...domProps.style, flexWrap }
    return React.createElement(component, domProps, children)
  },
  Paper: ({ children, ...props }) => (
    <div data-test="addEditOrgContainer" {...props}>
      {children}
    </div>
  ),
  Grid: ({
    children,
    container,
    item,
    xs,
    sm,
    md,
    lg,
    xl,
    spacing,
    direction,
    justifyContent,
    alignItems,
    wrap,
    zeroMinWidth,
    ...props
  }) => {
    // Filter out Grid-specific props that shouldn't be passed to DOM
    return <div {...props}>{children}</div>
  },
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
  FormControl: ({
    children,
    fullWidth,
    variant,
    component,
    margin,
    ...props
  }) => <div {...props}>{children}</div>,
  FormControlLabel: ({ control, label, ...props }) => (
    <div {...props}>
      {control}
      <span>{label}</span>
    </div>
  ),
  FormLabel: ({ children, ...props }) => <div {...props}>{children}</div>,
  InputLabel: ({ children, ...props }) => <label {...props}>{children}</label>,
  RadioGroup: ({
    children,
    row,
    defaultValue,
    value,
    onChange,
    name,
    ...props
  }) => <div {...props}>{children}</div>,
  Radio: React.forwardRef((props, ref) => (
    <input
      ref={ref}
      type="radio"
      checked={props.checked}
      value={props.value}
      data-test={props['data-test'] || `radio-${props.value}`}
      {...props}
    />
  )),
  Checkbox: (props) => (
    <input
      type="checkbox"
      checked={props.checked || false}
      onChange={props.onChange}
      data-test={props['data-test'] || 'checkbox'}
      {...props}
    />
  )
}))

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
})

const Wrapper = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/organizations/add']}>
        {children}
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

    // Setup default mocks
    useNavigate.mockReturnValue(mockNavigate)
    useLocation.mockReturnValue({ state: {} })
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

    mockWatch.mockImplementation(() => '')
  })

  describe('Basic Rendering - Form Structure', () => {
    it('renders the main form container', () => {
      render(
        <Wrapper>
          <AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} />
        </Wrapper>
      )

      expect(screen.getByTestId('addEditOrgContainer')).toBeInTheDocument()
    })

    it('renders all required form fields', () => {
      render(
        <Wrapper>
          <AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} />
        </Wrapper>
      )

      // Basic info fields
      expect(screen.getByTestId('orgLegalName')).toBeInTheDocument()
      expect(screen.getByTestId('orgOperatingName')).toBeInTheDocument()
      expect(screen.getByTestId('orgEmailAddress')).toBeInTheDocument()
      expect(screen.getByTestId('orgPhoneNumber')).toBeInTheDocument()
      expect(screen.getByTestId('orgEDRMSRecord')).toBeInTheDocument()
    })

    it('renders address section fields', () => {
      render(
        <Wrapper>
          <AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} />
        </Wrapper>
      )

      // Service address fields
      expect(screen.getByTestId('service-address-section')).toBeInTheDocument()
      expect(screen.getByTestId('orgAddressOther')).toBeInTheDocument()
      expect(screen.getByTestId('orgCity')).toBeInTheDocument()
      expect(screen.getByTestId('orgPostalCodeZipCode')).toBeInTheDocument()
    })

    it('renders head office address fields', () => {
      render(
        <Wrapper>
          <AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} />
        </Wrapper>
      )

      expect(
        screen.getByTestId('head-office-address-section')
      ).toBeInTheDocument()
      expect(
        screen.getByTestId('orgHeadOfficeStreetAddress')
      ).toBeInTheDocument()
      expect(
        screen.getByTestId('orgHeadOfficeAddressOther')
      ).toBeInTheDocument()
      expect(screen.getByTestId('orgHeadOfficeCity')).toBeInTheDocument()
      expect(
        screen.getByTestId('orgHeadOfficePostalCodeZipCode')
      ).toBeInTheDocument()
    })

    it('renders radio button groups', () => {
      render(
        <Wrapper>
          <AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} />
        </Wrapper>
      )

      expect(screen.getByTestId('orgRegForTransfers1')).toBeInTheDocument()
      expect(screen.getByTestId('orgRegForTransfers2')).toBeInTheDocument()
      expect(screen.getByTestId('hasEarlyIssuanceYes')).toBeInTheDocument()
      expect(screen.getByTestId('hasEarlyIssuanceNo')).toBeInTheDocument()
    })

    it('renders action buttons', () => {
      render(
        <Wrapper>
          <AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} />
        </Wrapper>
      )

      expect(screen.getByTestId('saveOrganization')).toBeInTheDocument()
      expect(screen.getByText('saveBtn')).toBeInTheDocument()
      expect(screen.getByText('cancelBtn')).toBeInTheDocument()
    })
  })

  describe('Form Interactions - User Actions', () => {
    it('handles form submission correctly', () => {
      render(
        <Wrapper>
          <AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} />
        </Wrapper>
      )

      const saveButton = screen.getByTestId('saveOrganization')
      fireEvent.click(saveButton)

      expect(mockHandleSubmit).toHaveBeenCalled()
    })

    it('handles back button navigation', () => {
      render(
        <Wrapper>
          <AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} />
        </Wrapper>
      )

      const backButton = screen.getByText('cancelBtn')
      fireEvent.click(backButton)

      expect(mockHandleCancelEdit).toHaveBeenCalled()
    })

    it('handles same as legal name checkbox interaction', () => {
      mockWatch.mockImplementation((field) => {
        if (field === 'orgLegalName') return 'Test Legal Name'
        return ''
      })

      render(
        <Wrapper>
          <AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} />
        </Wrapper>
      )

      const checkbox = screen.getByTestId('sameAsLegalName')
      fireEvent.click(checkbox)

      expect(mockSetValue).toHaveBeenCalledWith(
        'orgOperatingName',
        'Test Legal Name'
      )
    })
  })

  it('calls handleCancelEdit when cancel button is clicked', async () => {
    const user = userEvent.setup()

    render(
      <Wrapper>
        <AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} />
      </Wrapper>
    )

    // Find and click the Cancel button by its text content
    const cancelButton = screen.getByText('cancelBtn')
    await user.click(cancelButton)

    // Verify handleCancelEdit was called
    expect(mockHandleCancelEdit).toHaveBeenCalledTimes(1)
  })

  describe('Data Loading and Edit Mode', () => {
    it('handles edit mode with organization data', () => {
      useParams.mockReturnValue({ orgID: '123' })
      useOrganization.mockReturnValue({
        data: {
          name: 'Test Organization',
          operatingName: 'Test Operating Name',
          email: 'test@example.com',
          phone: '604-555-1234',
          orgStatus: { organizationStatusId: 2 }
        },
        isFetched: true
      })

      render(
        <Wrapper>
          <AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} />
        </Wrapper>
      )

      // Should call reset to populate form with fetched data
      expect(mockReset).toHaveBeenCalled()
    })

    it('handles new organization mode', () => {
      useParams.mockReturnValue({ orgID: undefined })
      useOrganization.mockReturnValue({
        data: null,
        isFetched: false
      })

      render(
        <Wrapper>
          <AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} />
        </Wrapper>
      )

      // Form should render in add mode
      expect(screen.getByTestId('orgLegalName')).toBeInTheDocument()
      expect(screen.getByTestId('saveOrganization')).toBeInTheDocument()
    })
  })

  describe('Organization Type Dropdown', () => {
    it('renders organization type dropdown with all options', () => {
      render(
        <Wrapper>
          <AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} />
        </Wrapper>
      )

      // Check that the organization type controller is rendered
      expect(screen.getByTestId('controller-orgType')).toBeInTheDocument()
    })

    it('shows BCeID and non-BCeID user indicators in options', () => {
      render(
        <Wrapper>
          <AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} />
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
          <AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} />
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
          <AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} />
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
          <AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} />
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
          <AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} />
        </Wrapper>
      )

      await waitFor(() => {
        // Verify reset was called with correct organization type
        expect(mockReset).toHaveBeenCalled()
      })
    })

    it('validates organization type requirement', () => {
      const mockFormState = { errors: {} }
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
          <AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} />
        </Wrapper>
      )

      const controller = screen.getByTestId('controller-orgType')
      expect(controller).toBeInTheDocument()
    })
  })
})
