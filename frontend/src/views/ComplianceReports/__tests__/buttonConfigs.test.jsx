import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buttonClusterConfigFn } from '../buttonConfigs'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { roles, govRoles } from '@/constants/roles'

// Mock FontAwesome icons
vi.mock('@fortawesome/free-solid-svg-icons', () => ({
  faPencil: 'faPencil',
  faTrash: 'faTrash'
}))

// Mock DateTime from luxon
vi.mock('luxon', () => ({
  DateTime: {
    now: vi.fn(() => ({
      year: 2024,
      month: 6,
      day: 15
    })),
    fromObject: vi.fn(() => ({
      toMillis: () => 1609459200000 // Jan 1, 2021
    }))
  }
}))

describe('ComplianceReports buttonConfigs', () => {
  let mockContext

  beforeEach(() => {
    vi.clearAllMocks()
    mockContext = {
      // Required fields
      currentStatus: COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER,
      hasRoles: vi.fn(),
      hasAnyRole: vi.fn(),
      t: vi.fn((key) => {
        // Mock translations based on actual keys
        const translations = {
          'report:actionBtns.assessReportBtn': 'Issue assessment',
          'report:actionBtns.issueNonAssessmentBtn': 'Issue non-assessment',
          'report:actionBtns.nonAssessment': 'Non-assessment',
          confirmation: 'Confirmation',
          cancelBtn: 'Cancel',
          'report:assessConfirmText':
            'Are you sure you want to assess this compliance report?',
          'report:nonAssessmentConfirmText':
            'Are you sure you want to mark this compliance report as non-assessment? This will immediately assess the report without issuing any compliance units.'
        }
        return translations[key] || key
      }),
      setModalData: vi.fn(),

      // Report metadata
      reportVersion: 0,
      compliancePeriod: '2024',
      isSigningAuthorityDeclared: true,

      // Report type flags
      isEarlyIssuance: false,
      isOriginalReport: true,
      isAnalystAdjustment: false,
      isNonAssessment: false,

      // Conflict detection
      hasDraftSupplemental: false,

      // Business rules
      hadBeenAssessed: false,

      // Action functions
      updateComplianceReport: vi.fn(),
      deleteComplianceReport: vi.fn(),
      createSupplementalReport: vi.fn(),
      createIdirSupplementalReport: vi.fn(),
      createAnalystAdjustment: vi.fn(),
      amendPenalties: vi.fn()
    }
  })

  describe('issueAssessment Button Configuration', () => {
    beforeEach(() => {
      // Mock director role
      mockContext.hasRoles.mockImplementation((role) => {
        return role === roles.director
      })
      mockContext.hasAnyRole.mockImplementation((...roleList) => {
        return (
          roleList.includes(roles.director) ||
          roleList.some((role) => govRoles.includes(role))
        )
      })
    })

    it('should show "Issue assessment" label when isNonAssessment is false', () => {
      mockContext.currentStatus =
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
      mockContext.isNonAssessment = false

      const config = buttonClusterConfigFn(mockContext)
      const issueAssessmentButton = config[
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
      ].find((button) => button.id === 'issue-assessment-btn')

      expect(issueAssessmentButton).toBeDefined()
      expect(issueAssessmentButton.label).toBe('Issue assessment')
      expect(issueAssessmentButton.id).toBe('issue-assessment-btn')
      expect(issueAssessmentButton.variant).toBe('contained')
      expect(issueAssessmentButton.color).toBe('primary')
    })

    it('should show "Issue non-assessment" label when isNonAssessment is true', () => {
      mockContext.currentStatus =
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
      mockContext.isNonAssessment = true

      const config = buttonClusterConfigFn(mockContext)
      const issueAssessmentButton = config[
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
      ].find((button) => button.id === 'issue-assessment-btn')

      expect(issueAssessmentButton).toBeDefined()
      expect(issueAssessmentButton.label).toBe('Issue non-assessment')
      expect(issueAssessmentButton.id).toBe('issue-assessment-btn')
      expect(issueAssessmentButton.variant).toBe('contained')
      expect(issueAssessmentButton.color).toBe('primary')
    })

    it('should show "Issue assessment" label when isNonAssessment is undefined', () => {
      mockContext.currentStatus =
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
      mockContext.isNonAssessment = undefined

      const config = buttonClusterConfigFn(mockContext)
      const issueAssessmentButton = config[
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
      ].find((button) => button.id === 'issue-assessment-btn')

      expect(issueAssessmentButton).toBeDefined()
      expect(issueAssessmentButton.label).toBe('Issue assessment')
    })

    it('should handle assessment flow when formData.isNonAssessment is false', () => {
      mockContext.currentStatus =
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
      mockContext.isNonAssessment = false

      const config = buttonClusterConfigFn(mockContext)
      const issueAssessmentButton = config[
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
      ].find((button) => button.id === 'issue-assessment-btn')

      const formData = { isNonAssessment: false }
      issueAssessmentButton.handler(formData)

      expect(mockContext.setModalData).toHaveBeenCalledWith({
        primaryButtonAction: expect.any(Function),
        primaryButtonText: 'Issue assessment',
        secondaryButtonText: 'Cancel',
        title: 'Confirmation',
        content: 'Are you sure you want to assess this compliance report?'
      })
    })

    it('should handle non-assessment flow when formData.isNonAssessment is true', () => {
      mockContext.currentStatus =
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
      mockContext.isNonAssessment = true

      const config = buttonClusterConfigFn(mockContext)
      const issueAssessmentButton = config[
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
      ].find((button) => button.id === 'issue-assessment-btn')

      const formData = { isNonAssessment: true }
      issueAssessmentButton.handler(formData)

      expect(mockContext.setModalData).toHaveBeenCalledWith({
        primaryButtonAction: expect.any(Function),
        primaryButtonText: 'Non-assessment',
        secondaryButtonText: 'Cancel',
        title: 'Confirmation',
        content:
          'Are you sure you want to mark this compliance report as non-assessment? This will immediately assess the report without issuing any compliance units.'
      })
    })

    it('should call updateComplianceReport with correct parameters when assessment button is clicked', () => {
      mockContext.currentStatus =
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
      mockContext.isNonAssessment = false

      const config = buttonClusterConfigFn(mockContext)
      const issueAssessmentButton = config[
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
      ].find((button) => button.id === 'issue-assessment-btn')

      const formData = { isNonAssessment: false, someOtherField: 'value' }
      issueAssessmentButton.handler(formData)

      // Get the modal data that was set
      const modalCall = mockContext.setModalData.mock.calls[0][0]

      // Execute the primary button action
      modalCall.primaryButtonAction()

      expect(mockContext.updateComplianceReport).toHaveBeenCalledWith({
        ...formData,
        status: COMPLIANCE_REPORT_STATUSES.ASSESSED
      })
    })

    it('should call updateComplianceReport with correct parameters when non-assessment button is clicked', () => {
      mockContext.currentStatus =
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
      mockContext.isNonAssessment = true

      const config = buttonClusterConfigFn(mockContext)
      const issueAssessmentButton = config[
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
      ].find((button) => button.id === 'issue-assessment-btn')

      const formData = { isNonAssessment: true, someOtherField: 'value' }
      issueAssessmentButton.handler(formData)

      // Get the modal data that was set
      const modalCall = mockContext.setModalData.mock.calls[0][0]

      // Execute the primary button action
      modalCall.primaryButtonAction()

      expect(mockContext.updateComplianceReport).toHaveBeenCalledWith({
        ...formData,
        status: COMPLIANCE_REPORT_STATUSES.ASSESSED
      })
    })
  })

  describe('buttonClusterConfigFn Integration', () => {
    beforeEach(() => {
      // Mock director role
      mockContext.hasRoles.mockImplementation((role) => {
        return role === roles.director
      })
      mockContext.hasAnyRole.mockImplementation((...roleList) => {
        return (
          roleList.includes(roles.director) ||
          roleList.some((role) => govRoles.includes(role))
        )
      })
    })

    it('should return issueAssessment button for IDIR Directors on RECOMMENDED_BY_MANAGER status', () => {
      mockContext.currentStatus =
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
      mockContext.isNonAssessment = false

      const config = buttonClusterConfigFn(mockContext)

      expect(
        config[COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER]
      ).toBeDefined()
      expect(
        config[COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER]
      ).toHaveLength(2) // issueAssessment + returnToManager

      const issueAssessmentButton = config[
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
      ].find((button) => button.id === 'issue-assessment-btn')

      expect(issueAssessmentButton).toBeDefined()
      expect(issueAssessmentButton.label).toBe('Issue assessment')
    })

    it('should return issueAssessment button with non-assessment label when isNonAssessment is true', () => {
      mockContext.currentStatus =
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
      mockContext.isNonAssessment = true

      const config = buttonClusterConfigFn(mockContext)

      const issueAssessmentButton = config[
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
      ].find((button) => button.id === 'issue-assessment-btn')

      expect(issueAssessmentButton).toBeDefined()
      expect(issueAssessmentButton.label).toBe('Issue non-assessment')
    })

    it('should also work for RECOMMENDED_BY_ANALYST status', () => {
      mockContext.currentStatus =
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST
      mockContext.isNonAssessment = true

      const config = buttonClusterConfigFn(mockContext)

      const issueAssessmentButton = config[
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST
      ].find((button) => button.id === 'issue-assessment-btn')

      expect(issueAssessmentButton).toBeDefined()
      expect(issueAssessmentButton.label).toBe('Issue non-assessment')
    })

    it('should not show issueAssessment button when hasDraftSupplemental is true', () => {
      mockContext.currentStatus =
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
      mockContext.hasDraftSupplemental = true

      const config = buttonClusterConfigFn(mockContext)

      const issueAssessmentButton = config[
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
      ].find((button) => button.id === 'issue-assessment-btn')

      expect(issueAssessmentButton).toBeUndefined()
    })
  })

  describe('Edge Cases', () => {
    beforeEach(() => {
      // Mock director role
      mockContext.hasRoles.mockImplementation((role) => {
        return role === roles.director
      })
      mockContext.hasAnyRole.mockImplementation((...roleList) => {
        return (
          roleList.includes(roles.director) ||
          roleList.some((role) => govRoles.includes(role))
        )
      })
      mockContext.currentStatus =
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
    })

    it('should handle null/undefined isNonAssessment gracefully', () => {
      mockContext.isNonAssessment = null

      const config = buttonClusterConfigFn(mockContext)
      const issueAssessmentButton = config[
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
      ].find((button) => button.id === 'issue-assessment-btn')

      expect(issueAssessmentButton.label).toBe('Issue assessment')
    })

    it('should preserve all other button properties when label changes', () => {
      mockContext.isNonAssessment = true

      const config = buttonClusterConfigFn(mockContext)
      const issueAssessmentButton = config[
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
      ].find((button) => button.id === 'issue-assessment-btn')

      expect(issueAssessmentButton).toMatchObject({
        variant: 'contained',
        color: 'primary',
        id: 'issue-assessment-btn',
        disabled: false,
        handler: expect.any(Function)
      })
    })

    it('should handle translation function errors gracefully', () => {
      mockContext.t.mockImplementation(() => {
        throw new Error('Translation error')
      })

      expect(() => {
        buttonClusterConfigFn(mockContext)
      }).toThrow('Translation error')
    })
  })
})
