import { render, screen, fireEvent } from '@testing-library/react'
import { AssessmentStatement } from '../AssessmentStatement'
import { useForm } from 'react-hook-form'
import { describe, beforeEach, test, expect, vi } from 'vite-plus/test'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import type { ReactNode } from 'react'
import type { UseFormReturn } from 'react-hook-form'

const {
  mockUseCurrentUser,
  mockUseUpdateComplianceReport,
  mockComplianceReportStore,
  mockUseParams
} = vi.hoisted(() => ({
  mockUseCurrentUser: vi.fn(),
  mockUseUpdateComplianceReport: vi.fn(),
  mockComplianceReportStore: vi.fn(),
  mockUseParams: vi.fn()
}))

interface MockLayoutProps {
  children?: ReactNode
  [property: string]: unknown
}

// Mock the hooks
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: mockUseCurrentUser
}))
vi.mock('@/hooks/useComplianceReports', () => ({
  useUpdateComplianceReport: mockUseUpdateComplianceReport
}))
vi.mock('@/stores/useComplianceReportStore', () => ({
  default: mockComplianceReportStore
}))
vi.mock('react-router-dom', () => ({
  useParams: mockUseParams
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'report:assessmentRecommendation': 'Assessment Recommendation',
        'report:directorStatement': 'Director Statement',
        'report:assessmentStatementInstructions': 'Instructions for assessment',
        'report:saveStatement': 'Save Statement',
        'report:assessmentStatementSaveSuccess':
          'Assessment statement saved successfully',
        'report:assessmentStatementSaveError':
          'Error saving assessment statement'
      }
      return translations[key] || key
    }
  })
}))

// Mock BC components to prevent the linearGradient error
vi.mock('@/components/BCBox', () => ({
  default: ({ children, ...props }: MockLayoutProps) => (
    <div data-testid="bc-box" data-test="bc-box" {...props}>
      {children}
    </div>
  )
}))

vi.mock('@/components/BCTypography', () => ({
  default: ({ children, ...props }: MockLayoutProps) => (
    <div data-testid="bc-typography" {...props}>
      {children}
    </div>
  )
}))

vi.mock('@/components/BCButton', () => ({
  default: ({ children, ...props }: MockLayoutProps) => (
    <button data-testid="bc-button" {...props}>
      {children}
    </button>
  )
}))

vi.mock('@/components/BCAlert', () => ({
  FloatingAlert: vi
    .fn()
    .mockImplementation(({ children, ...props }: MockLayoutProps) => {
      const { ref } = props
      // Mock the imperative handle
      if (ref && typeof ref === 'object' && 'current' in ref) {
        const mutableRef = ref as { current: unknown }
        mutableRef.current = { triggerAlert: vi.fn() }
      }
      return (
        <div data-testid="floating-alert" {...props}>
          {children}
        </div>
      )
    })
}))

vi.mock('@/components/Loading', () => ({
  default: () => <div data-testid="loading-component">Loading...</div>
}))

const mockReportData = {
  currentReport: {
    report: {
      assessmentStatement: 'Initial assessment',
      currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED }
    }
  }
}

// Test wrapper component that provides form context
type AssessmentFormValues = { assessmentStatement: string }
const TestWrapper = ({
  children,
  initialValues = {}
}: {
  children: (props: {
    methods: UseFormReturn<AssessmentFormValues>
  }) => ReactNode
  initialValues?: Partial<AssessmentFormValues>
}) => {
  const methods = useForm({
    defaultValues: {
      assessmentStatement: '',
      ...initialValues
    }
  })

  return <div>{children({ methods })}</div>
}

describe('AssessmentStatement Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mocks
    mockUseCurrentUser.mockReturnValue({
      data: {
        organization: { organizationId: 'org1' },
        roles: ['Analyst']
      },
      isLoading: false,
      hasRoles: vi.fn((role: string) => ['Analyst'].includes(role))
    })

    mockComplianceReportStore.mockReturnValue(mockReportData)

    mockUseUpdateComplianceReport.mockReturnValue({
      mutate: vi.fn(),
      isPending: false
    })

    mockUseParams.mockReturnValue({ complianceReportId: '123' })
  })

  test('renders without errors', async () => {
    render(
      <TestWrapper>
        {({ methods }) => <AssessmentStatement methods={methods} />}
      </TestWrapper>
    )
    // Use querySelector directly to handle potential attribute differences
    expect(document.querySelector('[data-testid="bc-box"]')).not.toBeNull()
  })

  test('displays the correct headings', async () => {
    render(
      <TestWrapper>
        {({ methods }) => <AssessmentStatement methods={methods} />}
      </TestWrapper>
    )

    // Check for headings
    expect(screen.getByText('Director Statement')).toBeInTheDocument()
    expect(screen.getByText('Instructions for assessment')).toBeInTheDocument()
    expect(screen.getByText('Save Statement')).toBeInTheDocument()
  })

  test('shows loading state when user data is loading', async () => {
    // Mock the loading state
    mockUseCurrentUser.mockReturnValue({
      isLoading: true,
      hasRoles: vi.fn()
    })

    render(
      <TestWrapper>
        {({ methods }) => <AssessmentStatement methods={methods} />}
      </TestWrapper>
    )

    // Component should still render but without interactive elements when user is loading
    // Check that the main content is rendered but disabled
    const inputElement = screen.getByRole('textbox') as HTMLInputElement
    expect(inputElement).toBeDisabled()
  })

  test('disables input for unauthorized roles based on report status', async () => {
    // Set up for a Compliance Manager with incompatible report status
    mockUseCurrentUser.mockReturnValue({
      data: {
        organization: { organizationId: 'org1' },
        roles: ['Compliance Manager']
      },
      isLoading: false,
      hasRoles: vi.fn((role: string) => ['Compliance Manager'].includes(role))
    })

    // Update the store mock to return the appropriate status
    mockComplianceReportStore.mockReturnValue({
      currentReport: {
        report: {
          assessmentStatement: 'Initial assessment',
          currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED } // Not "Recommended by analyst"
        }
      }
    })

    render(
      <TestWrapper>
        {({ methods }) => <AssessmentStatement methods={methods} />}
      </TestWrapper>
    )

    // Check that the input is disabled
    const inputElement = screen.getByRole('textbox') as HTMLInputElement
    expect(inputElement).toBeDisabled()

    // Check that the save button is disabled
    const saveButton = screen.getByText('Save Statement')
    expect(saveButton).toBeDisabled()
  })

  test('enables input for authorized roles with correct report status', async () => {
    // Set up for an Analyst with compatible report status
    mockUseCurrentUser.mockReturnValue({
      data: {
        organization: { organizationId: 'org1' },
        roles: ['Analyst']
      },
      isLoading: false,
      hasRoles: vi.fn((role: string) => ['Analyst'].includes(role))
    })

    mockComplianceReportStore.mockReturnValue({
      currentReport: {
        report: {
          assessmentStatement: 'Initial assessment',
          currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED }
        }
      }
    })

    render(
      <TestWrapper>
        {({ methods }) => <AssessmentStatement methods={methods} />}
      </TestWrapper>
    )

    // Check that the input is enabled
    const inputElement = screen.getByRole('textbox') as HTMLInputElement
    expect(inputElement).not.toBeDisabled()

    // Check that the save button is enabled
    const saveButton = screen.getByText('Save Statement')
    expect(saveButton).not.toBeDisabled()
  })

  test('calls mutate function on form submit with valid data', async () => {
    const mutateMock = vi.fn()

    mockUseUpdateComplianceReport.mockReturnValue({
      mutate: mutateMock,
      isPending: false
    })

    mockComplianceReportStore.mockReturnValue({
      currentReport: {
        report: {
          assessmentStatement: 'Initial assessment',
          currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED }
        }
      }
    })

    render(
      <TestWrapper
        initialValues={{ assessmentStatement: 'Initial assessment' }}
      >
        {({ methods }) => <AssessmentStatement methods={methods} />}
      </TestWrapper>
    )

    // Find the input field and change its value
    const inputElement = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(inputElement, {
      target: { value: 'Updated assessment statement' }
    })

    // Find and click the save button
    const saveButton = screen.getByText('Save Statement')
    fireEvent.click(saveButton)

    // Verify the mutate function was called with the correct data
    expect(mutateMock).toHaveBeenCalledWith(
      {
        assessmentStatement: 'Updated assessment statement',
        status: COMPLIANCE_REPORT_STATUSES.SUBMITTED
      },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function)
      })
    )
  })

  test('displays initial assessment statement from form', async () => {
    mockComplianceReportStore.mockReturnValue({
      currentReport: {
        report: {
          assessmentStatement: 'Test initial statement',
          currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED }
        }
      }
    })

    render(
      <TestWrapper
        initialValues={{ assessmentStatement: 'Test initial statement' }}
      >
        {({ methods }) => <AssessmentStatement methods={methods} />}
      </TestWrapper>
    )

    const inputElement = screen.getByRole('textbox') as HTMLInputElement
    expect(inputElement.value).toBe('Test initial statement')
  })

  test('handles different role and status combinations correctly', async () => {
    // Test Compliance Manager with correct status
    mockUseCurrentUser.mockReturnValue({
      data: {
        organization: { organizationId: 'org1' },
        roles: ['Compliance Manager']
      },
      isLoading: false,
      hasRoles: vi.fn((role: string) => ['Compliance Manager'].includes(role))
    })

    mockComplianceReportStore.mockReturnValue({
      currentReport: {
        report: {
          assessmentStatement: 'Initial assessment',
          currentStatus: {
            status: COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST
          }
        }
      }
    })

    render(
      <TestWrapper>
        {({ methods }) => <AssessmentStatement methods={methods} />}
      </TestWrapper>
    )

    // Should be enabled for Compliance Manager with RECOMMENDED_BY_ANALYST status
    const inputElement = screen.getByRole('textbox') as HTMLInputElement
    expect(inputElement).not.toBeDisabled()

    const saveButton = screen.getByText('Save Statement')
    expect(saveButton).not.toBeDisabled()
  })

  test('form integration works correctly with getValues', async () => {
    const mutateMock = vi.fn()

    mockUseUpdateComplianceReport.mockReturnValue({
      mutate: mutateMock,
      isPending: false
    })

    mockComplianceReportStore.mockReturnValue({
      currentReport: {
        report: {
          assessmentStatement: 'Initial assessment',
          currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED }
        }
      }
    })

    render(
      <TestWrapper
        initialValues={{ assessmentStatement: 'Form initial value' }}
      >
        {({ methods }) => <AssessmentStatement methods={methods} />}
      </TestWrapper>
    )

    // The input should show the form's initial value
    const inputElement = screen.getByRole('textbox') as HTMLInputElement
    expect(inputElement.value).toBe('Form initial value')

    // Change the value and save
    fireEvent.change(inputElement, {
      target: { value: 'New assessment statement' }
    })

    const saveButton = screen.getByText('Save Statement')
    fireEvent.click(saveButton)

    // Verify the mutate function was called with the updated value from the form
    expect(mutateMock).toHaveBeenCalledWith(
      {
        assessmentStatement: 'New assessment statement',
        status: COMPLIANCE_REPORT_STATUSES.SUBMITTED
      },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function)
      })
    )
  })

  test('callback functions are defined and available', async () => {
    const mutateMock = vi.fn()

    mockUseUpdateComplianceReport.mockReturnValue({
      mutate: mutateMock,
      isPending: false
    })

    mockUseCurrentUser.mockReturnValue({
      data: {
        organization: { organizationId: 'org1' },
        roles: ['Analyst']
      },
      isLoading: false,
      hasRoles: vi.fn((role: string) => ['Analyst'].includes(role))
    })

    render(
      <TestWrapper initialValues={{ assessmentStatement: 'Test statement' }}>
        {({ methods }) => <AssessmentStatement methods={methods} />}
      </TestWrapper>
    )

    const saveButton = screen.getByText('Save Statement')
    fireEvent.click(saveButton)

    // Verify the mutate function was called with callback functions
    expect(mutateMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function)
      })
    )

    // Verify we can access and execute the callback functions without error
    const callArgs = mutateMock.mock.calls[0]
    const callbacks = callArgs[1]

    expect(typeof callbacks.onSuccess).toBe('function')
    expect(typeof callbacks.onError).toBe('function')

    // Execute callbacks to ensure they don't throw errors
    expect(() => callbacks.onSuccess()).not.toThrow()
    expect(() => callbacks.onError()).not.toThrow()
  })

  test('handles director role with RECOMMENDED_BY_MANAGER status', async () => {
    mockUseCurrentUser.mockReturnValue({
      data: {
        organization: { organizationId: 'org1' },
        roles: ['Director']
      },
      isLoading: false,
      hasRoles: vi.fn((role: string) => ['Director'].includes(role))
    })

    mockComplianceReportStore.mockReturnValue({
      currentReport: {
        report: {
          assessmentStatement: 'Director assessment',
          currentStatus: {
            status: COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
          }
        }
      }
    })

    render(
      <TestWrapper>
        {({ methods }) => <AssessmentStatement methods={methods} />}
      </TestWrapper>
    )

    // Should be enabled for Director with RECOMMENDED_BY_MANAGER status
    const inputElement = screen.getByRole('textbox')
    expect(inputElement).not.toBeDisabled()

    const saveButton = screen.getByText('Save Statement')
    expect(saveButton).not.toBeDisabled()
  })

  test('handles handleSaveAssessmentStatement function execution', async () => {
    const mutateMock = vi.fn()

    mockUseUpdateComplianceReport.mockReturnValue({
      mutate: mutateMock,
      isPending: false
    })

    mockUseCurrentUser.mockReturnValue({
      data: {
        organization: { organizationId: 'org1' },
        roles: ['Analyst']
      },
      isLoading: false,
      hasRoles: vi.fn((role: string) => ['Analyst'].includes(role))
    })

    const mockGetValues = vi.fn().mockReturnValue('New assessment statement')

    render(
      <TestWrapper initialValues={{ assessmentStatement: 'Initial' }}>
        {({ methods }) => {
          methods.getValues = mockGetValues
          return <AssessmentStatement methods={methods} />
        }}
      </TestWrapper>
    )

    const saveButton = screen.getByText('Save Statement')
    fireEvent.click(saveButton)

    // Verify getValues was called correctly
    expect(mockGetValues).toHaveBeenCalledWith('assessmentStatement')

    // Verify mutate was called with correct data structure
    expect(mutateMock).toHaveBeenCalledWith(
      {
        assessmentStatement: 'New assessment statement',
        status: COMPLIANCE_REPORT_STATUSES.SUBMITTED
      },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function)
      })
    )
  })
})
