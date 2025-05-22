import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { AssessmentStatement } from '../AssessmentStatement'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  useGetComplianceReport,
  useUpdateComplianceReport
} from '@/hooks/useComplianceReports'
import { useParams } from 'react-router-dom'
import { describe, beforeEach, test, expect, vi } from 'vitest'

// Mock the hooks
vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useComplianceReports')
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
        'report:saveStatement': 'Save Statement'
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

describe('AssessmentStatement Component', () => {
  beforeEach(() => {
    // Setup default mocks
    useCurrentUser.mockReturnValue({
      data: {
        organization: { organizationId: 'org1' },
        roles: ['Analyst']
      },
      isLoading: false,
      hasRoles: (role) => ['Analyst'].includes(role)
    })

    useGetComplianceReport.mockReturnValue({
      data: {
        report: {
          assessmentStatement: 'Initial assessment',
          currentStatus: { status: 'Submitted' }
        }
      },
      isLoading: false
    })

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

  test('shows loading state when data is loading', async () => {
    // Mock the loading state
    useCurrentUser.mockReturnValue({
      isLoading: true,
      hasRoles: vi.fn()
    })

    useGetComplianceReport.mockReturnValue({
      isLoading: true
    })

    render(<AssessmentStatement />)

    // Simply check that the main content is not rendered when loading
    expect(
      screen.queryByText('Assessment Recommendation')
    ).not.toBeInTheDocument()

    // Instead of checking for a specific test ID, verify the Loading component is rendered
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  test('disables input for unauthorized roles based on report status', async () => {
    // Set up for a Compliance Manager with incompatible report status
    useCurrentUser.mockReturnValue({
      data: {
        organization: { organizationId: 'org1' },
        roles: ['Compliance Manager']
      },
      isLoading: false,
      hasRoles: (role) => ['Compliance Manager'].includes(role)
    })

    useGetComplianceReport.mockReturnValue({
      data: {
        report: {
          assessmentStatement: 'Initial assessment',
          currentStatus: { status: 'Submitted' } // Not "Recommended by analyst"
        }
      },
      isLoading: false
    })

    render(<AssessmentStatement />)

    // Check that the input is disabled
    const inputElement = screen.getByRole('textbox')
    expect(inputElement).toBeDisabled()

    // Check that the save button is disabled
    const saveButton = screen.getByText('Save Statement')
    expect(saveButton).toBeDisabled()
  })

  test('calls mutate function on form submit with valid data', async () => {
    const mutateMock = vi.fn()

    useUpdateComplianceReport.mockReturnValue({
      mutate: mutateMock,
      isPending: false
    })

    useGetComplianceReport.mockReturnValue({
      data: {
        report: {
          assessmentStatement: 'Initial assessment',
          currentStatus: { status: 'Submitted' }
        }
      },
      isLoading: false
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
        status: 'Submitted'
      },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function)
      })
    )
  })
})
