import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { AssessmentStatement } from '../AssessmentStatement'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useUpdateComplianceReport } from '@/hooks/useComplianceReports'
import useComplianceReportStore from '@/stores/useComplianceReportStore'
import { useParams } from 'react-router-dom'
import { describe, beforeEach, test, expect, vi } from 'vitest'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'

// Mock the hooks
vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useComplianceReports')
vi.mock('@/stores/useComplianceReportStore')
vi.mock('react-router-dom', () => ({
  useParams: vi.fn()
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => {
      const translations = {
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
  default: ({ children, ...props }) => (
    <div data-testid="bc-box" data-test="bc-box" {...props}>
      {children}
    </div>
  )
}))

vi.mock('@/components/BCTypography', () => ({
  default: ({ children, ...props }) => (
    <div data-testid="bc-typography" {...props}>
      {children}
    </div>
  )
}))

vi.mock('@/components/BCButton', () => ({
  default: ({ children, ...props }) => (
    <button data-testid="bc-button" {...props}>
      {children}
    </button>
  )
}))

vi.mock('@/components/BCAlert', () => ({
  FloatingAlert: vi.fn().mockImplementation(({ children, ...props }) => (
    <div data-testid="floating-alert" {...props}>
      {children}
    </div>
  ))
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

describe('AssessmentStatement Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mocks
    useCurrentUser.mockReturnValue({
      data: {
        organization: { organizationId: 'org1' },
        roles: ['Analyst']
      },
      isLoading: false,
      hasRoles: vi.fn((role) => ['Analyst'].includes(role))
    })

    useComplianceReportStore.mockReturnValue(mockReportData)

    useUpdateComplianceReport.mockReturnValue({
      mutate: vi.fn(),
      isPending: false
    })

    useParams.mockReturnValue({ complianceReportId: '123' })
  })

  test('renders without errors', async () => {
    render(<AssessmentStatement />)
    // Use querySelector directly to handle potential attribute differences
    expect(document.querySelector('[data-testid="bc-box"]')).not.toBeNull()
  })

  test('displays the correct headings', async () => {
    render(<AssessmentStatement />)

    // Check for headings
    expect(screen.getByText('Director Statement')).toBeInTheDocument()
    expect(screen.getByText('Instructions for assessment')).toBeInTheDocument()
    expect(screen.getByText('Save Statement')).toBeInTheDocument()
  })

  test('shows loading state when user data is loading', async () => {
    // Mock the loading state
    useCurrentUser.mockReturnValue({
      isLoading: true,
      hasRoles: vi.fn()
    })

    render(<AssessmentStatement />)

    // Component should still render but without interactive elements when user is loading
    // Check that the main content is rendered but disabled
    const inputElement = screen.getByRole('textbox')
    expect(inputElement).toBeDisabled()
  })

  test('disables input for unauthorized roles based on report status', async () => {
    // Set up for a Compliance Manager with incompatible report status
    useCurrentUser.mockReturnValue({
      data: {
        organization: { organizationId: 'org1' },
        roles: ['Compliance Manager']
      },
      isLoading: false,
      hasRoles: vi.fn((role) => ['Compliance Manager'].includes(role))
    })

    // Update the store mock to return the appropriate status
    useComplianceReportStore.mockReturnValue({
      currentReport: {
        report: {
          assessmentStatement: 'Initial assessment',
          currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED } // Not "Recommended by analyst"
        }
      }
    })

    render(<AssessmentStatement />)

    // Check that the input is disabled
    const inputElement = screen.getByRole('textbox')
    expect(inputElement).toBeDisabled()

    // Check that the save button is disabled
    const saveButton = screen.getByText('Save Statement')
    expect(saveButton).toBeDisabled()
  })

  test('enables input for authorized roles with correct report status', async () => {
    // Set up for an Analyst with compatible report status
    useCurrentUser.mockReturnValue({
      data: {
        organization: { organizationId: 'org1' },
        roles: ['Analyst']
      },
      isLoading: false,
      hasRoles: vi.fn((role) => ['Analyst'].includes(role))
    })

    useComplianceReportStore.mockReturnValue({
      currentReport: {
        report: {
          assessmentStatement: 'Initial assessment',
          currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED }
        }
      }
    })

    render(<AssessmentStatement />)

    // Check that the input is enabled
    const inputElement = screen.getByRole('textbox')
    expect(inputElement).not.toBeDisabled()

    // Check that the save button is enabled
    const saveButton = screen.getByText('Save Statement')
    expect(saveButton).not.toBeDisabled()
  })

  test('calls mutate function on form submit with valid data', async () => {
    const mutateMock = vi.fn()

    useUpdateComplianceReport.mockReturnValue({
      mutate: mutateMock,
      isPending: false
    })

    useComplianceReportStore.mockReturnValue({
      currentReport: {
        report: {
          assessmentStatement: 'Initial assessment',
          currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED }
        }
      }
    })

    render(<AssessmentStatement />)

    // Find the input field and change its value
    const inputElement = screen.getByRole('textbox')
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

  test('displays initial assessment statement from store', async () => {
    useComplianceReportStore.mockReturnValue({
      currentReport: {
        report: {
          assessmentStatement: 'Test initial statement',
          currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED }
        }
      }
    })

    render(<AssessmentStatement />)

    const inputElement = screen.getByRole('textbox')
    expect(inputElement.value).toBe('Test initial statement')
  })

  test('handles different role and status combinations correctly', async () => {
    // Test Compliance Manager with correct status
    useCurrentUser.mockReturnValue({
      data: {
        organization: { organizationId: 'org1' },
        roles: ['Compliance Manager']
      },
      isLoading: false,
      hasRoles: vi.fn((role) => ['Compliance Manager'].includes(role))
    })

    useComplianceReportStore.mockReturnValue({
      currentReport: {
        report: {
          assessmentStatement: 'Initial assessment',
          currentStatus: {
            status: COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST
          }
        }
      }
    })

    render(<AssessmentStatement />)

    // Should be enabled for Compliance Manager with RECOMMENDED_BY_ANALYST status
    const inputElement = screen.getByRole('textbox')
    expect(inputElement).not.toBeDisabled()

    const saveButton = screen.getByText('Save Statement')
    expect(saveButton).not.toBeDisabled()
  })
})
