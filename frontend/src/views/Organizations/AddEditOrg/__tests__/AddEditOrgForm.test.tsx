import React from 'react'
import { beforeEach, describe, it, expect, vi } from 'vite-plus/test'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddEditOrgForm } from '../AddEditOrgForm'
import { MemoryRouter } from 'react-router-dom'
import '@/routes/routes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import type { PropsWithChildren, ReactNode } from 'react'
import type { AddressAutocompleteProps } from '@/components/BCForm/AddressAutocomplete'
import type { BCFormCheckboxProps } from '@/components/BCForm/BCFormCheckbox'
import type {
  OrganizationData,
  OrganizationTypeData
} from '@/hooks/useOrganization'

type ReferenceCompareProps = {
  title: string
  data?: Array<{ label?: string; value: string }>
  onDismiss?: () => void
}

type TestOrganizationHook = () => {
  data?: OrganizationData
  isFetched: boolean
}
type TestOrganizationTypesHook = () => {
  data?: OrganizationTypeData[]
  isLoading?: boolean
  error?: Error | null
}
const hooks = vi.hoisted(() => ({
  useNavigate: vi.fn<() => () => void>(),
  useParams: vi.fn<() => { orgID?: string }>(),
  useLocation: vi.fn<() => { state: unknown }>(),
  useApiService: vi.fn<
    () => {
      post: (...args: unknown[]) => unknown
      put: (...args: unknown[]) => unknown
    }
  >(),
  useOrganization: vi.fn<TestOrganizationHook>(),
  useOrganizationTypes: vi.fn<TestOrganizationTypesHook>()
}))

// Mock form implementation
const mockSetValue = vi.fn()
const mockWatch = vi.fn()
const mockTrigger = vi.fn()
const mockReset = vi.fn()
const mockSetError = vi.fn()
const mockHandleSubmit = vi.fn(
  (fn: (data: Record<string, unknown>) => unknown) =>
    (event?: { preventDefault?: () => void }) => {
      event?.preventDefault?.()
      fn({
        orgLegalName: 'Test Org',
        orgOperatingName: 'Test Operating',
        orgEmailAddress: 'test@example.com',
        orgPhoneNumber: '604-555-1234',
        orgContactName: 'Jane Contact',
        orgStreetAddress: '123 Test St',
        orgCity: 'Test City',
        orgPostalCodeZipCode: 'V6B3K9',
        orgRegForTransfers: '1',
        hasEarlyIssuance: 'no',
        orgEDRMSRecord: 'EDRMS-123',
        orgTypeIds: ['1'],
        availableRoles: ['Compliance Reporting']
      })
    }
)

// Mock dependencies
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useParams: hooks.useParams,
    useNavigate: hooks.useNavigate,
    useLocation: hooks.useLocation
  }
})

vi.mock('@/services/useApiService', () => ({
  useApiService: hooks.useApiService
}))

vi.mock('@/hooks/useOrganization', () => ({
  useOrganization: hooks.useOrganization,
  useOrganizationTypes: hooks.useOrganizationTypes
}))

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: vi.fn(() => ({
      t: (key: string) =>
        key === 'org:sameAsLegalNameLabel' ? 'Same as legal name' : key,
      i18n: { changeLanguage: vi.fn() }
    })),
    I18nextProvider: ({ children }: PropsWithChildren) => children
  }
})

vi.mock('react-hook-form', () => ({
  useForm: () => ({
    register: vi.fn().mockImplementation((name: string) => ({
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
    setError: mockSetError,
    clearErrors: vi.fn(),
    control: {}
  }),
  Controller: ({
    name,
    render
  }: {
    name: string
    render: (args: {
      field: {
        onChange: () => void
        value: string
        name: string
        ref: () => void
      }
      fieldState: Record<string, never>
    }) => ReactNode
  }) => {
    return (
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
    )
  }
}))

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
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
  default: (
    props: PropsWithChildren<{
      onClick?: () => void
      type?: 'button' | 'reset' | 'submit'
      ['data-test']?: string
      ['data-testid']?: string
    }>
  ) => (
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
  default: (props: PropsWithChildren<{ severity?: string }>) => (
    <div data-testid="bc-alert" data-severity={props.severity}>
      {props.children}
    </div>
  ),
  BCAlert2: React.forwardRef(function BCAlertMock(
    props: { dismissable?: boolean },
    ref: React.ForwardedRef<{
      triggerAlert: (payload: { severity: string; message: string }) => void
    }>
  ) {
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
  default: (props: { message?: ReactNode }) => (
    <div data-testid="loading">{props.message}</div>
  )
}))

vi.mock('@/components/BCForm/AddressAutocomplete', () => ({
  AddressAutocomplete: React.forwardRef(function AddressAutocompleteMock(
    props: AddressAutocompleteProps & { name?: string },
    ref: React.ForwardedRef<HTMLInputElement>
  ) {
    return (
      <input
        ref={ref}
        data-test={`address-autocomplete-${props.name || 'default'}`}
        data-testid="address-autocomplete"
        value={
          typeof props.value === 'string'
            ? props.value
            : props.value?.fullAddress || ''
        }
        onChange={(e) => props.onChange && props.onChange(e.target.value)}
      />
    )
  }),
  BCFormCheckbox: ({
    name,
    label,
    options
  }: BCFormCheckboxProps<Record<string, string[]>>) => (
    <div
      data-test={`${name}-checkbox-group`}
      data-testid={`${name}-checkbox-group`}
    >
      <span>{label}</span>
      {(options || []).map((option) => (
        <label key={option.value}>
          <input type="checkbox" value={option.value} readOnly />
          {option.label}
        </label>
      ))}
    </div>
  )
}))

vi.mock('../ReferenceCompareBox', () => ({
  default: (props: ReferenceCompareProps) => (
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
vi.mock('@mui/material/Box', () => ({
  default: ({
    children,
    component = 'div',
    flexWrap,
    ...props
  }: PropsWithChildren<{
    component?: React.ElementType
    flexWrap?: React.CSSProperties['flexWrap']
    [key: string]: unknown
  }>) => {
    const domProps = flexWrap ? { ...props, style: { flexWrap } } : props
    return React.createElement(component, domProps, children)
  }
}))

vi.mock('@mui/material/Paper', () => ({
  default: ({
    children,
    ...props
  }: PropsWithChildren<Record<string, unknown>>) => (
    <div data-test="addEditOrgContainer" {...props}>
      {children}
    </div>
  )
}))

vi.mock('@mui/material/Grid', () => ({
  default: (props: PropsWithChildren<Record<string, unknown>>) => {
    const { children, ...domProps } = props
    // Filter out Grid-specific props that shouldn't be passed to DOM
    for (const key of [
      'container',
      'item',
      'xs',
      'sm',
      'md',
      'lg',
      'xl',
      'spacing',
      'direction',
      'justifyContent',
      'alignItems',
      'wrap',
      'zeroMinWidth'
    ]) {
      delete domProps[key]
    }
    return <div {...domProps}>{children}</div>
  }
}))

vi.mock('@mui/material/TextField', () => ({
  default: React.forwardRef(function TextFieldMock(
    {
      id,
      label,
      error,
      helperText,
      fullWidth,
      variant,
      select,
      children,
      ...props
    }: {
      id?: string
      label?: ReactNode
      error?: boolean
      helperText?: ReactNode
      fullWidth?: boolean
      variant?: string
      select?: boolean
      children?: ReactNode
      SelectProps?: object
      ['data-test']?: string
      [key: string]: unknown
    },
    ref: React.ForwardedRef<HTMLInputElement>
  ) {
    delete props.SelectProps
    return (
      <div data-testid={id || 'text-field'}>
        {label && <label htmlFor={id}>{label}</label>}
        {select ? (
          <select id={id} data-test={props['data-test']} {...props}>
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
  })
}))

vi.mock('@mui/material/FormControl', () => ({
  default: (props: PropsWithChildren<Record<string, unknown>>) => {
    const { children, ...domProps } = props
    for (const key of ['fullWidth', 'variant', 'component', 'margin']) {
      delete domProps[key]
    }
    return <div {...domProps}>{children}</div>
  }
}))

vi.mock('@mui/material/FormControlLabel', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@mui/material/FormControlLabel')>()
  return { default: actual.default }
})

vi.mock('@mui/material/FormLabel', () => ({
  default: ({
    children,
    ...props
  }: PropsWithChildren<Record<string, unknown>>) => (
    <div {...props}>{children}</div>
  )
}))

vi.mock('@mui/material/InputLabel', () => ({
  default: ({
    children,
    ...props
  }: PropsWithChildren<Record<string, unknown>>) => (
    <label {...props}>{children}</label>
  )
}))

vi.mock('@mui/material/RadioGroup', () => ({
  default: (props: PropsWithChildren<Record<string, unknown>>) => {
    const { children, ...domProps } = props
    for (const key of ['row', 'defaultValue', 'value', 'onChange', 'name']) {
      delete domProps[key]
    }
    return <div {...domProps}>{children}</div>
  }
}))

vi.mock('@mui/material/Radio', () => ({
  default: React.forwardRef(function RadioMock(
    props: React.ComponentProps<'input'> & { ['data-test']?: string },
    ref: React.ForwardedRef<HTMLInputElement>
  ) {
    return (
      <input
        ref={ref}
        type="radio"
        checked={props.checked}
        value={props.value}
        data-test={props['data-test'] || `radio-${props.value}`}
        {...props}
      />
    )
  })
}))

vi.mock('@mui/material/Checkbox', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mui/material/Checkbox')>()
  return { default: actual.default }
})

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
})

const Wrapper = ({ children }: PropsWithChildren) => (
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
    hooks.useNavigate.mockReturnValue(mockNavigate)
    hooks.useLocation.mockReturnValue({ state: {} })
    hooks.useApiService.mockReturnValue({
      post: mockApiPost,
      put: mockApiPut
    })
    hooks.useParams.mockReturnValue({ orgID: undefined })
    hooks.useOrganization.mockReturnValue({
      data: undefined,
      isFetched: false
    })
    hooks.useOrganizationTypes.mockReturnValue({
      data: mockOrgTypes,
      isLoading: false,
      error: null
    })

    mockWatch.mockImplementation(() => '')
    mockSetError.mockClear()
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
      expect(screen.getByTestId('orgContactName')).toBeInTheDocument()
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

    it('exposes and toggles the same as legal name checkbox by its visible label', async () => {
      const user = userEvent.setup()
      mockWatch.mockImplementation((field) => {
        if (field === 'orgLegalName') return 'Test Legal Name'
        return ''
      })

      render(
        <Wrapper>
          <AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} />
        </Wrapper>
      )

      const checkbox = screen.getByRole('checkbox', {
        name: 'Same as legal name'
      })
      expect(checkbox).not.toBeChecked()

      await user.click(checkbox)

      expect(checkbox).toBeChecked()
      expect(mockSetValue).toHaveBeenCalledWith(
        'orgOperatingName',
        'Test Legal Name'
      )

      await user.click(checkbox)

      expect(checkbox).not.toBeChecked()
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
      hooks.useParams.mockReturnValue({ orgID: '123' })
      hooks.useOrganization.mockReturnValue({
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
      hooks.useParams.mockReturnValue({ orgID: undefined })
      hooks.useOrganization.mockReturnValue({
        data: undefined,
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

  describe('Organization Type Checkboxes', () => {
    it('renders the organization type checkbox group with all options', () => {
      render(
        <Wrapper>
          <AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} />
        </Wrapper>
      )

      expect(
        screen.getByTestId('orgTypeIds-checkbox-group')
      ).toBeInTheDocument()
      expect(screen.getByText('Fuel supplier')).toBeInTheDocument()
      expect(screen.getByText('Aggregator')).toBeInTheDocument()
    })

    it('does not append BCeID suffixes to the option labels', () => {
      render(
        <Wrapper>
          <AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} />
        </Wrapper>
      )

      expect(screen.queryByText(/\(BCeID user\)/)).not.toBeInTheDocument()
      expect(screen.queryByText(/\(non-BCeID user\)/)).not.toBeInTheDocument()
    })

    it('renders the roles available checkbox group with the four org-controllable roles', () => {
      render(
        <Wrapper>
          <AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} />
        </Wrapper>
      )

      expect(
        screen.getByTestId('availableRoles-checkbox-group')
      ).toBeInTheDocument()
      expect(screen.getByText('Compliance reporting')).toBeInTheDocument()
      expect(screen.getByText('Credit transfer')).toBeInTheDocument()
      expect(screen.getByText('CI applicant')).toBeInTheDocument()
      expect(screen.getByText('IA proponent')).toBeInTheDocument()
    })

    it('handles organization type loading state', () => {
      hooks.useOrganizationTypes.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null
      })

      render(
        <Wrapper>
          <AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} />
        </Wrapper>
      )

      // Should still render the (empty) checkbox group even when loading
      expect(
        screen.getByTestId('orgTypeIds-checkbox-group')
      ).toBeInTheDocument()
    })

    it('handles organization type error state', () => {
      hooks.useOrganizationTypes.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Failed to load organization types')
      })

      render(
        <Wrapper>
          <AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} />
        </Wrapper>
      )

      // Should still render the checkbox group even when there's an error
      expect(
        screen.getByTestId('orgTypeIds-checkbox-group')
      ).toBeInTheDocument()
    })

    it('populates form correctly in edit mode with organization type', async () => {
      hooks.useParams.mockReturnValue({ orgID: '123' })
      hooks.useOrganization.mockReturnValue({
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

    it('suggests a type’s typical roles when the analyst checks it (#4565)', () => {
      let typeIds = ['1']
      mockWatch.mockImplementation((field) => {
        if (field === 'orgTypeIds') return typeIds
        if (field === 'availableRoles') return []
        return ''
      })
      const { rerender } = render(
        <Wrapper>
          <AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} />
        </Wrapper>
      )
      mockSetValue.mockClear()

      // Analyst checks Fuel producer (id 3)
      typeIds = ['1', '3']
      rerender(
        <Wrapper>
          <AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} />
        </Wrapper>
      )

      expect(mockSetValue).toHaveBeenCalledWith(
        'availableRoles',
        ['CI Applicant'],
        { shouldDirty: true }
      )
    })

    it('does not change roles when a type is unchecked', () => {
      let typeIds = ['1', '3']
      mockWatch.mockImplementation((field) => {
        if (field === 'orgTypeIds') return typeIds
        if (field === 'availableRoles') return ['CI Applicant']
        return ''
      })
      const { rerender } = render(
        <Wrapper>
          <AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} />
        </Wrapper>
      )
      mockSetValue.mockClear()

      typeIds = ['1']
      rerender(
        <Wrapper>
          <AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} />
        </Wrapper>
      )

      expect(mockSetValue).not.toHaveBeenCalledWith(
        'availableRoles',
        expect.anything(),
        expect.anything()
      )
    })

    it('does not suggest roles while hydrating an existing organization', () => {
      hooks.useParams.mockReturnValue({ orgID: '123' })
      hooks.useOrganization.mockReturnValue({
        data: {
          name: 'Existing Org',
          operatingName: 'Existing Org',
          email: 'existing@example.com',
          orgTypes: [{ organizationTypeId: 3, orgType: 'fuel_producer' }],
          availableRoles: [],
          orgStatus: { organizationStatusId: 2 }
        },
        isFetched: true
      })
      mockWatch.mockImplementation((field) => {
        if (field === 'orgTypeIds') return ['3']
        if (field === 'availableRoles') return []
        return ''
      })

      render(
        <Wrapper>
          <AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} />
        </Wrapper>
      )

      // The analyst deliberately left CI applicant unchecked on this org;
      // loading it must not re-suggest the role.
      expect(mockSetValue).not.toHaveBeenCalledWith(
        'availableRoles',
        expect.anything(),
        expect.anything()
      )
      expect(mockReset).toHaveBeenCalled()
    })

    it('renders both checkbox groups side by side', () => {
      render(
        <Wrapper>
          <AddEditOrgForm handleCancelEdit={mockHandleCancelEdit} />
        </Wrapper>
      )

      expect(
        screen.getByTestId('orgTypeIds-checkbox-group')
      ).toBeInTheDocument()
      expect(
        screen.getByTestId('availableRoles-checkbox-group')
      ).toBeInTheDocument()
    })
  })
})
