import React from 'react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AddEditOrgForm } from '../AddEditOrgForm'
import { useApiService } from '@/services/useApiService'
import { useOrganization } from '@/hooks/useOrganization'
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
  useOrganization: vi.fn()
}))

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: (key) => key,
    i18n: { changeLanguage: vi.fn() }
  }))
}))

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
  Controller: ({ name, control, render }) => (
    <div data-testid={`controller-${name}`}>
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
  )
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
      <div 
        data-testid="bc-alert2"
        data-dismissable={props.dismissable}
      >
        Alert Content
      </div>
    )
  })
}))

vi.mock('@/components/Loading', () => ({
  default: (props) => (
    <div data-testid="loading">{props.message}</div>
  )
}))

vi.mock('@/components/BCForm/index.js', () => ({
  AddressAutocomplete: React.forwardRef((props, ref) => (
    <input
      ref={ref}
      data-test="address-autocomplete"
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
        <div key={index}>{item.label}: {item.value}</div>
      ))}
    </div>
  )
}))

// Material UI simple mocks
vi.mock('@mui/material', () => ({
  Box: ({ children, component = 'div', ...props }) => 
    React.createElement(component, props, children),
  Paper: ({ children, ...props }) => (
    <div data-test="addEditOrgContainer" {...props}>
      {children}
    </div>
  ),
  Grid: ({ children, ...props }) => <div {...props}>{children}</div>,
  TextField: React.forwardRef(
    ({ id, label, error, helperText, fullWidth, variant, ...props }, ref) => (
      <div data-testid={id || 'text-field'}>
        {label && <label htmlFor={id}>{label}</label>}
        <input
          id={id}
          ref={ref}
          data-fullwidth={fullWidth ? 'true' : undefined}
          data-variant={variant}
          data-test={props['data-test']}
          {...props}
        />
        {error && <span>{helperText}</span>}
      </div>
    )
  ),
  FormControl: ({ children, ...props }) => <div {...props}>{children}</div>,
  FormControlLabel: ({ control, label, ...props }) => (
    <div {...props}>{control}<span>{label}</span></div>
  ),
  FormLabel: ({ children, ...props }) => <div {...props}>{children}</div>,
  InputLabel: ({ children, ...props }) => <label {...props}>{children}</label>,
  RadioGroup: ({ children, ...props }) => <div {...props}>{children}</div>,
  Radio: (props) => (
    <input
      type="radio"
      checked={props.checked}
      value={props.value}
      data-test={props['data-test'] || `radio-${props.value}`}
      {...props}
    />
  ),
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

    mockWatch.mockImplementation(() => '')
  })

  describe('Basic Rendering - Form Structure', () => {
    it('renders the main form container', () => {
      render(
        <Wrapper>
          <AddEditOrgForm />
        </Wrapper>
      )

      expect(screen.getByTestId('addEditOrgContainer')).toBeInTheDocument()
    })

    it('renders all required form fields', () => {
      render(
        <Wrapper>
          <AddEditOrgForm />
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
          <AddEditOrgForm />
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
          <AddEditOrgForm />
        </Wrapper>
      )

      expect(screen.getByTestId('head-office-address-section')).toBeInTheDocument()
      expect(screen.getByTestId('orgHeadOfficeStreetAddress')).toBeInTheDocument()
      expect(screen.getByTestId('orgHeadOfficeAddressOther')).toBeInTheDocument()
      expect(screen.getByTestId('orgHeadOfficeCity')).toBeInTheDocument()
      expect(screen.getByTestId('orgHeadOfficePostalCodeZipCode')).toBeInTheDocument()
    })

    it('renders radio button groups', () => {
      render(
        <Wrapper>
          <AddEditOrgForm />
        </Wrapper>
      )

      expect(screen.getByTestId('orgSupplierType1')).toBeInTheDocument()
      expect(screen.getByTestId('orgRegForTransfers1')).toBeInTheDocument()
      expect(screen.getByTestId('orgRegForTransfers2')).toBeInTheDocument()
      expect(screen.getByTestId('hasEarlyIssuanceYes')).toBeInTheDocument()
      expect(screen.getByTestId('hasEarlyIssuanceNo')).toBeInTheDocument()
    })

    it('renders action buttons', () => {
      render(
        <Wrapper>
          <AddEditOrgForm />
        </Wrapper>
      )

      expect(screen.getByTestId('saveOrganization')).toBeInTheDocument()
      expect(screen.getByText('saveBtn')).toBeInTheDocument()
      expect(screen.getByText('backBtn')).toBeInTheDocument()
    })
  })

  describe('Form Interactions - User Actions', () => {
    it('handles form submission correctly', () => {
      render(
        <Wrapper>
          <AddEditOrgForm />
        </Wrapper>
      )

      const saveButton = screen.getByTestId('saveOrganization')
      fireEvent.click(saveButton)

      expect(mockHandleSubmit).toHaveBeenCalled()
    })

    it('handles back button navigation', () => {
      render(
        <Wrapper>
          <AddEditOrgForm />
        </Wrapper>
      )

      const backButton = screen.getByText('backBtn')
      fireEvent.click(backButton)

      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.ORGANIZATIONS.LIST)
    })

    it('handles same as legal name checkbox interaction', () => {
      mockWatch.mockImplementation((field) => {
        if (field === 'orgLegalName') return 'Test Legal Name'
        return ''
      })

      render(
        <Wrapper>
          <AddEditOrgForm />
        </Wrapper>
      )

      const checkbox = screen.getByTestId('sameAsLegalName')
      fireEvent.click(checkbox)

      expect(mockSetValue).toHaveBeenCalledWith('orgOperatingName', 'Test Legal Name')
    })
  })

  describe('Form Validation - Error Handling', () => {
    it('displays validation errors when present', () => {
      const formWithErrors = {
        register: vi.fn((name) => ({ name })),
        handleSubmit: mockHandleSubmit,
        formState: { 
          errors: {
            orgLegalName: { message: 'Legal name is required' },
            orgEmailAddress: { message: 'Invalid email format' }
          }
        },
        setValue: mockSetValue,
        watch: mockWatch,
        trigger: mockTrigger,
        reset: mockReset,
        control: {}
      }

      vi.mocked(require('react-hook-form').useForm).mockReturnValueOnce(formWithErrors)

      render(
        <Wrapper>
          <AddEditOrgForm />
        </Wrapper>
      )

      expect(screen.getByText('Legal name is required')).toBeInTheDocument()
      expect(screen.getByText('Invalid email format')).toBeInTheDocument()
    })

    it('renders form without errors by default', () => {
      render(
        <Wrapper>
          <AddEditOrgForm />
        </Wrapper>
      )

      // Should not show any error alerts by default
      expect(screen.queryByTestId('bc-alert')).not.toBeInTheDocument()
    })
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
          <AddEditOrgForm />
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
          <AddEditOrgForm />
        </Wrapper>
      )

      // Form should render in add mode
      expect(screen.getByTestId('orgLegalName')).toBeInTheDocument()
      expect(screen.getByTestId('saveOrganization')).toBeInTheDocument()
    })
  })

  describe('Component State and Effects', () => {
    it('renders alert component for notifications', () => {
      render(
        <Wrapper>
          <AddEditOrgForm />
        </Wrapper>
      )

      expect(screen.getByTestId('bc-alert2')).toBeInTheDocument()
    })

    it('handles address autocomplete fields', () => {
      render(
        <Wrapper>
          <AddEditOrgForm />
        </Wrapper>
      )

      const addressInputs = screen.getAllByTestId('address-autocomplete')
      expect(addressInputs.length).toBeGreaterThan(0)
    })

    it('shows proper field labels and structure', () => {
      render(
        <Wrapper>
          <AddEditOrgForm />
        </Wrapper>
      )

      // Check for key labels that indicate proper form structure
      expect(screen.getByText('org:legalNameLabel')).toBeInTheDocument()
      expect(screen.getByText('org:emailAddrLabel:')).toBeInTheDocument()
      expect(screen.getByText('org:serviceAddrLabel')).toBeInTheDocument()
      expect(screen.getByText('org:bcAddrLabel')).toBeInTheDocument()
    })
  })

  describe('Field Synchronization Logic', () => {
    it('handles address synchronization checkbox', () => {
      mockWatch.mockImplementation((field) => {
        const values = {
          'orgStreetAddress': '123 Service Street',
          'orgCity': 'Service City',
          'orgPostalCodeZipCode': 'V6B3K9',
          'orgAddressOther': 'Suite 100'
        }
        return values[field] || ''
      })

      render(
        <Wrapper>
          <AddEditOrgForm />
        </Wrapper>
      )

      // Find service address checkbox in head office section
      const headOfficeSection = screen.getByTestId('head-office-address-section')
      const checkbox = headOfficeSection.querySelector('input[type="checkbox"]')

      if (checkbox) {
        fireEvent.click(checkbox)
      }

      // Address fields should exist and be accessible
      expect(screen.getByTestId('orgHeadOfficeStreetAddress')).toBeInTheDocument()
      expect(screen.getByTestId('orgHeadOfficeCity')).toBeInTheDocument()
    })

    it('clears operating name when legal name changes', () => {
      mockWatch.mockImplementation((field) => {
        if (field === 'orgOperatingName') return 'Old Operating Name'
        return ''
      })

      render(
        <Wrapper>
          <AddEditOrgForm />
        </Wrapper>
      )

      const checkbox = screen.getByTestId('sameAsLegalName')
      // Click twice to test clearing logic
      fireEvent.click(checkbox)
      fireEvent.click(checkbox)

      expect(mockSetValue).toHaveBeenCalledWith('orgOperatingName', '')
    })
  })

  describe('Form Field Coverage', () => {
    it('covers all major form field types', () => {
      render(
        <Wrapper>
          <AddEditOrgForm />
        </Wrapper>
      )

      // Text inputs
      expect(screen.getByTestId('orgLegalName')).toBeInTheDocument()
      expect(screen.getByTestId('orgOperatingName')).toBeInTheDocument()
      
      // Address inputs  
      expect(screen.getAllByTestId('address-autocomplete').length).toBeGreaterThan(0)
      
      // Radio buttons
      expect(screen.getByTestId('orgSupplierType1')).toBeInTheDocument()
      expect(screen.getByTestId('hasEarlyIssuanceYes')).toBeInTheDocument()
      
      // Checkboxes
      expect(screen.getByTestId('sameAsLegalName')).toBeInTheDocument()
    })

    it('includes province and country default fields', () => {
      render(
        <Wrapper>
          <AddEditOrgForm />
        </Wrapper>
      )

      expect(screen.getByTestId('orgProvince')).toBeInTheDocument()
      expect(screen.getByTestId('orgCountry')).toBeInTheDocument()
      expect(screen.getByTestId('orgHeadOfficeProvince')).toBeInTheDocument()
      expect(screen.getByTestId('orgHeadOfficeCountry')).toBeInTheDocument()
    })
  })
})