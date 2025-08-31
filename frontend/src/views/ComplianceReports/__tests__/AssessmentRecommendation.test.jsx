import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { AssessmentRecommendation } from '../components/AssessmentRecommendation'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { roles } from '@/constants/roles'
import { isFeatureEnabled } from '@/constants/config'

// Create mock functions at top level to avoid hoisting issues
const mockNavigate = vi.fn()
const mockCreateAnalystAdjustment = vi.fn()
const mockUpdateComplianceReport = vi.fn()
const mockHasRoles = vi.fn(() => false)
const mockIsFeatureEnabled = vi.fn(() => false)
const mockCurrentUserData = { isGovernmentUser: true }

// Mock hooks
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate
}))

vi.mock('@/hooks/useComplianceReports', () => ({
  useCreateAnalystAdjustment: () => ({
    mutate: mockCreateAnalystAdjustment,
    isLoading: false
  }),
  useUpdateComplianceReport: () => ({
    mutate: mockUpdateComplianceReport
  })
}))

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    hasRoles: mockHasRoles,
    data: mockCurrentUserData
  })
}))

vi.mock('@/constants/config', () => ({
  FEATURE_FLAGS: {
    GOVERNMENT_ADJUSTMENT: 'GOVERNMENT_ADJUSTMENT'
  },
  isFeatureEnabled: vi.fn(() => false)
}))

// Mock components with simple implementations
vi.mock('@/components/BCButton', () => ({
  default: ({ children, onClick, disabled, ...props }) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  )
}))

vi.mock('@/components/BCTypography/index.jsx', () => ({
  default: ({ children, ...props }) => <span {...props}>{children}</span>
}))

vi.mock('@/components/BCBox/index.jsx', () => ({
  default: ({ children, ...props }) => <div {...props}>{children}</div>
}))

vi.mock('@/components/BCModal.jsx', () => ({
  default: ({ open, data, onClose, ...props }) => 
    open ? (
      <div data-test="modal" {...props}>
        <div>{data?.title}</div>
        <div>{data?.content}</div>
        <button onClick={data?.primaryButtonAction}>
          {data?.primaryButtonText}
        </button>
        <button onClick={onClose}>
          {data?.secondaryButtonText}
        </button>
      </div>
    ) : null
}))

// Mock Material-UI components
vi.mock('@mui/material', () => ({
  Tooltip: ({ children }) => children,
  FormControlLabel: ({ control, label }) => (
    <label>
      {control}
      <span>{label}</span>
    </label>
  ),
  Checkbox: ({ checked, onChange, disabled }) => (
    <input 
      type="checkbox" 
      checked={checked} 
      onChange={(e) => onChange?.(e)}
      disabled={disabled}
    />
  ),
  Fade: ({ children, in: fadeIn }) => fadeIn ? <div>{children}</div> : null
}))

vi.mock('@mui/icons-material', () => ({
  Assignment: () => <span>Assignment Icon</span>,
  CheckCircle: () => <span>CheckCircle Icon</span>
}))

describe('AssessmentRecommendation', () => {
  let defaultProps

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset mocks to defaults
    mockHasRoles.mockReturnValue(false)
    vi.mocked(isFeatureEnabled).mockReturnValue(false)
    mockCurrentUserData.isGovernmentUser = true

    defaultProps = {
      reportData: {
        report: {
          version: 0,
          supplementalInitiator: null,
          reportingFrequency: 'Annual'
        },
        isNewest: true
      },
      currentStatus: COMPLIANCE_REPORT_STATUSES.SUBMITTED,
      complianceReportId: 123,
      methods: {
        setValue: vi.fn(),
        watch: vi.fn(() => false)
      }
    }
  })

  describe('Basic Rendering', () => {
    it('renders the component without crashing', () => {
      const { container } = render(<AssessmentRecommendation {...defaultProps} />)
      expect(container).toBeInTheDocument()
    })
  })

  describe('Computed Values - isOriginalReport', () => {
    it('handles original report (version 0, no supplemental, not quarterly)', () => {
      const props = {
        ...defaultProps,
        reportData: {
          ...defaultProps.reportData,
          report: {
            version: 0,
            supplementalInitiator: null,
            reportingFrequency: 'Annual'
          }
        }
      }
      const { container } = render(<AssessmentRecommendation {...props} />)
      expect(container).toBeInTheDocument()
    })

    it('handles non-original report (version > 0)', () => {
      const props = {
        ...defaultProps,
        reportData: {
          ...defaultProps.reportData,
          report: {
            version: 1,
            supplementalInitiator: null,
            reportingFrequency: 'Annual'
          }
        }
      }
      const { container } = render(<AssessmentRecommendation {...props} />)
      expect(container).toBeInTheDocument()
    })

    it('handles supplemental report', () => {
      const props = {
        ...defaultProps,
        reportData: {
          ...defaultProps.reportData,
          report: {
            version: 0,
            supplementalInitiator: 'some-initiator',
            reportingFrequency: 'Annual'
          }
        }
      }
      const { container } = render(<AssessmentRecommendation {...props} />)
      expect(container).toBeInTheDocument()
    })

    it('handles quarterly report', () => {
      const props = {
        ...defaultProps,
        reportData: {
          ...defaultProps.reportData,
          report: {
            version: 0,
            supplementalInitiator: null,
            reportingFrequency: 'Quarterly'
          }
        }
      }
      const { container } = render(<AssessmentRecommendation {...props} />)
      expect(container).toBeInTheDocument()
    })
  })

  describe('Conditional Rendering - Government Adjustment Section', () => {
    it('shows government adjustment section when feature enabled and status is submitted', () => {
      vi.mocked(isFeatureEnabled).mockReturnValue(true)

      render(<AssessmentRecommendation {...defaultProps} />)
      expect(screen.getByText('Analyst adjustment')).toBeInTheDocument()
    })

    it('hides government adjustment section when feature disabled', () => {
      vi.mocked(isFeatureEnabled).mockReturnValue(false)

      render(<AssessmentRecommendation {...defaultProps} />)
      expect(screen.queryByText('Analyst adjustment')).not.toBeInTheDocument()
    })

    it('hides government adjustment section when status is not submitted', () => {
      vi.mocked(isFeatureEnabled).mockReturnValue(true)

      const props = {
        ...defaultProps,
        currentStatus: COMPLIANCE_REPORT_STATUSES.ASSESSED
      }

      render(<AssessmentRecommendation {...props} />)
      expect(screen.queryByText('Analyst adjustment')).not.toBeInTheDocument()
    })
  })

  describe('Conditional Rendering - Non-Assessment Section', () => {
    it('shows non-assessment section when user is government analyst and report is original', () => {
      mockHasRoles.mockImplementation((role) => role === roles.analyst)
      mockCurrentUserData.isGovernmentUser = true

      render(<AssessmentRecommendation {...defaultProps} />)
      expect(screen.getByText('report:notSubjectToAssessment')).toBeInTheDocument()
    })

    it('hides non-assessment section when user is not government user', () => {
      mockHasRoles.mockImplementation((role) => role === roles.analyst)
      mockCurrentUserData.isGovernmentUser = false

      render(<AssessmentRecommendation {...defaultProps} />)
      expect(screen.queryByText('report:notSubjectToAssessment')).not.toBeInTheDocument()
    })

    it('hides non-assessment section when user is not analyst', () => {
      mockHasRoles.mockReturnValue(false)
      mockCurrentUserData.isGovernmentUser = true

      render(<AssessmentRecommendation {...defaultProps} />)
      expect(screen.queryByText('report:notSubjectToAssessment')).not.toBeInTheDocument()
    })
  })

  describe('Conditional Rendering - Reassessment Button', () => {
    it('shows reassessment button when feature enabled and status is assessed', () => {
      vi.mocked(isFeatureEnabled).mockReturnValue(true)

      const props = {
        ...defaultProps,
        currentStatus: COMPLIANCE_REPORT_STATUSES.ASSESSED
      }

      render(<AssessmentRecommendation {...props} />)
      expect(screen.getByText('report:createReassessmentBtn')).toBeInTheDocument()
    })

    it('hides reassessment button when feature disabled', () => {
      vi.mocked(isFeatureEnabled).mockReturnValue(false)

      const props = {
        ...defaultProps,
        currentStatus: COMPLIANCE_REPORT_STATUSES.ASSESSED
      }

      render(<AssessmentRecommendation {...props} />)
      expect(screen.queryByText('report:createReassessmentBtn')).not.toBeInTheDocument()
    })

    it('disables reassessment button when report is not newest', () => {
      vi.mocked(isFeatureEnabled).mockReturnValue(true)

      const props = {
        ...defaultProps,
        currentStatus: COMPLIANCE_REPORT_STATUSES.ASSESSED,
        reportData: {
          ...defaultProps.reportData,
          isNewest: false
        }
      }

      render(<AssessmentRecommendation {...props} />)
      const button = screen.getByText('report:createReassessmentBtn')
      expect(button).toBeDisabled()
    })
  })

  describe('Event Handlers', () => {
    it('opens adjustment dialog when analyst adjustment button clicked', () => {
      vi.mocked(isFeatureEnabled).mockReturnValue(true)

      render(<AssessmentRecommendation {...defaultProps} />)
      
      const button = screen.getByText('Analyst adjustment')
      fireEvent.click(button)

      expect(screen.getByText('Create analyst adjustment')).toBeInTheDocument()
    })

    it('opens reassessment dialog when reassessment button clicked', () => {
      vi.mocked(isFeatureEnabled).mockReturnValue(true)

      const props = {
        ...defaultProps,
        currentStatus: COMPLIANCE_REPORT_STATUSES.ASSESSED
      }

      render(<AssessmentRecommendation {...props} />)
      
      const button = screen.getByText('report:createReassessmentBtn')
      fireEvent.click(button)

      expect(screen.getByText('Create reassessment')).toBeInTheDocument()
    })

    it('calls createAnalystAdjustment when modal primary button clicked', () => {
      vi.mocked(isFeatureEnabled).mockReturnValue(true)

      render(<AssessmentRecommendation {...defaultProps} />)
      
      // Open dialog
      const button = screen.getByText('Analyst adjustment')
      fireEvent.click(button)

      // Click create button
      const createButton = screen.getByText('Create')
      fireEvent.click(createButton)

      expect(mockCreateAnalystAdjustment).toHaveBeenCalledWith(123)
    })

    it('handles non-assessment checkbox change', () => {
      mockHasRoles.mockImplementation((role) => role === roles.analyst)
      mockCurrentUserData.isGovernmentUser = true

      render(<AssessmentRecommendation {...defaultProps} />)
      
      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)

      expect(defaultProps.methods.setValue).toHaveBeenCalledWith('isNonAssessment', true)
      expect(mockUpdateComplianceReport).toHaveBeenCalledWith({
        status: COMPLIANCE_REPORT_STATUSES.SUBMITTED,
        isNonAssessment: true
      })
    })
  })

  describe('Modal Dialogs', () => {
    it('renders adjustment modal with correct content', () => {
      vi.mocked(isFeatureEnabled).mockReturnValue(true)

      render(<AssessmentRecommendation {...defaultProps} />)
      
      const button = screen.getByText('Analyst adjustment')
      fireEvent.click(button)

      expect(screen.getByText('Create analyst adjustment')).toBeInTheDocument()
      expect(screen.getByText(/This will put the report into edit mode/)).toBeInTheDocument()
    })

    it('renders reassessment modal with correct content', () => {
      vi.mocked(isFeatureEnabled).mockReturnValue(true)

      const props = {
        ...defaultProps,
        currentStatus: COMPLIANCE_REPORT_STATUSES.ASSESSED
      }

      render(<AssessmentRecommendation {...props} />)
      
      const button = screen.getByText('report:createReassessmentBtn')
      fireEvent.click(button)

      expect(screen.getByText('Create reassessment')).toBeInTheDocument()
      expect(screen.getByText(/This will create a new version/)).toBeInTheDocument()
    })

    it('closes dialogs when cancel button clicked', () => {
      vi.mocked(isFeatureEnabled).mockReturnValue(true)

      render(<AssessmentRecommendation {...defaultProps} />)
      
      // Open dialog
      const button = screen.getByText('Analyst adjustment')
      fireEvent.click(button)

      expect(screen.getByText('Create analyst adjustment')).toBeInTheDocument()

      // Close dialog
      const cancelButton = screen.getByText('Cancel')
      fireEvent.click(cancelButton)

      expect(screen.queryByText('Create analyst adjustment')).not.toBeInTheDocument()
    })
  })
})