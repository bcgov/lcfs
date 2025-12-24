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

      // RECOMMENDED_BY_ANALYST doesn't have issueAssessment button for directors
      // Directors can only recommendByManager or returnToAnalyst at this status
      const buttons = config[COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST]
      expect(buttons).toBeDefined()
      expect(buttons.some((b) => b.id === 'recommend-by-manager-btn' || b.id === 'return-to-analyst-btn')).toBe(true)
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

  describe('Director Delegated Authority', () => {
    beforeEach(() => {
      mockContext.hasRoles.mockImplementation((role) => role === roles.director)
      mockContext.hasAnyRole.mockImplementation((...roleList) =>
        roleList.includes(roles.director)
      )
    })

    describe('Director Acting as Analyst', () => {
      it('should show "Recommend to Director" button with correct tooltip for Director', () => {
        mockContext.currentStatus = COMPLIANCE_REPORT_STATUSES.SUBMITTED

        const config = buttonClusterConfigFn(mockContext)
        const recommendButton = config[
          COMPLIANCE_REPORT_STATUSES.SUBMITTED
        ].find((btn) => btn.id === 'recommend-by-analyst-btn')

        expect(recommendButton).toBeDefined()
        expect(recommendButton.tooltip).toBe('Acting as Analyst')
        expect(recommendButton.roleIndicator).toBe('Analyst')
      })

      it('should show "Return to Supplier" button with correct tooltip for Director', () => {
        mockContext.currentStatus = COMPLIANCE_REPORT_STATUSES.SUBMITTED

        const config = buttonClusterConfigFn(mockContext)
        const returnButton = config[COMPLIANCE_REPORT_STATUSES.SUBMITTED].find(
          (btn) => btn.id === 'return-to-supplier-btn'
        )

        expect(returnButton).toBeDefined()
        expect(returnButton.tooltip).toBe('Acting as Analyst')
        expect(returnButton.roleIndicator).toBe('Analyst')
      })

      it('should NOT show "Create Supplemental Report" button for Director', () => {
        mockContext.currentStatus = COMPLIANCE_REPORT_STATUSES.SUBMITTED

        const config = buttonClusterConfigFn(mockContext)
        const supplementalButton = config[
          COMPLIANCE_REPORT_STATUSES.SUBMITTED
        ].find((btn) => btn.id === 'create-idir-supplemental-btn')

        expect(supplementalButton).toBeUndefined()
      })
    })

    describe('Director Acting as Compliance Manager', () => {
      it('should show "Recommend to Director" button with correct tooltip from Manager status', () => {
        mockContext.currentStatus =
          COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST

        const config = buttonClusterConfigFn(mockContext)
        const recommendButton = config[
          COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST
        ].find((btn) => btn.id === 'recommend-by-manager-btn')

        expect(recommendButton).toBeDefined()
        expect(recommendButton.tooltip).toBe('Acting as Compliance Manager')
        expect(recommendButton.roleIndicator).toBe('Manager')
      })

      it('should show "Return to Analyst" button with correct tooltip for Director', () => {
        mockContext.currentStatus =
          COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST

        const config = buttonClusterConfigFn(mockContext)
        const returnButton = config[
          COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST
        ].find((btn) => btn.id === 'return-to-analyst-btn')

        expect(returnButton).toBeDefined()
        expect(returnButton.tooltip).toBe('Acting as Compliance Manager')
        expect(returnButton.roleIndicator).toBe('Manager')
      })
    })

    describe('Director Native Actions', () => {
      it('should show "Issue Assessment" button without delegated authority indicator', () => {
        mockContext.currentStatus =
          COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER

        const config = buttonClusterConfigFn(mockContext)
        const issueButton = config[
          COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
        ].find((btn) => btn.id === 'issue-assessment-btn')

        expect(issueButton).toBeDefined()
        expect(issueButton.tooltip).toBeFalsy()
        expect(issueButton.roleIndicator).toBeFalsy()
      })

      it('should NOT show "Create Reassessment" button for Director', () => {
        mockContext.currentStatus = COMPLIANCE_REPORT_STATUSES.ASSESSED
        mockContext.hadBeenAssessed = true

        const config = buttonClusterConfigFn(mockContext)
        const reassessmentButton = config[
          COMPLIANCE_REPORT_STATUSES.ASSESSED
        ]?.find((btn) => btn.id === 'create-government-adjustment-btn')

        expect(reassessmentButton).toBeUndefined()
      })
    })

    describe('Button Grouping', () => {
      it('should separate Director buttons from delegated authority buttons', () => {
        // Use ANALYST_ADJUSTMENT status where director has both:
        // - recommendByAnalyst (Analyst role - has roleIndicator)
        // - issueAssessment (Director role - no roleIndicator)
        mockContext.currentStatus = COMPLIANCE_REPORT_STATUSES.ANALYST_ADJUSTMENT

        const config = buttonClusterConfigFn(mockContext)
        const buttons = config[COMPLIANCE_REPORT_STATUSES.ANALYST_ADJUSTMENT]

        const directorButtons = buttons.filter((btn) => !btn.roleIndicator)
        const delegatedButtons = buttons.filter((btn) => btn.roleIndicator)

        expect(directorButtons.length).toBeGreaterThan(0)
        expect(delegatedButtons.length).toBeGreaterThan(0)
      })

      it('should group Analyst-level actions with same tooltip', () => {
        mockContext.currentStatus = COMPLIANCE_REPORT_STATUSES.SUBMITTED

        const config = buttonClusterConfigFn(mockContext)
        const delegatedButtons = config[
          COMPLIANCE_REPORT_STATUSES.SUBMITTED
        ].filter((btn) => btn.roleIndicator === 'Analyst')

        expect(delegatedButtons.length).toBeGreaterThan(0)
        delegatedButtons.forEach((btn) => {
          expect(btn.tooltip).toBe('Acting as Analyst')
        })
      })

      it('should group Manager-level actions with same tooltip', () => {
        mockContext.currentStatus =
          COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST

        const config = buttonClusterConfigFn(mockContext)
        const delegatedButtons = config[
          COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST
        ].filter((btn) => btn.roleIndicator === 'Manager')

        expect(delegatedButtons.length).toBeGreaterThan(0)
        delegatedButtons.forEach((btn) => {
          expect(btn.tooltip).toBe('Acting as Compliance Manager')
        })
      })
    })

    describe('Comparison with Analyst', () => {
      it('should show delegated authority tooltips for Director', () => {
        mockContext.currentStatus = COMPLIANCE_REPORT_STATUSES.SUBMITTED

        const config = buttonClusterConfigFn(mockContext)
        const directorButtons = config[COMPLIANCE_REPORT_STATUSES.SUBMITTED]

        // Director should have buttons with tooltips for delegated actions
        expect(directorButtons).toBeDefined()
        expect(directorButtons.length).toBeGreaterThan(0)

        const directorButtonsWithTooltips = directorButtons.filter(
          (btn) => btn.tooltip
        )

        // At least some buttons should have tooltips (delegated authority)
        expect(directorButtonsWithTooltips.length).toBeGreaterThan(0)

        // All tooltips should indicate delegated authority
        directorButtonsWithTooltips.forEach((btn) => {
          expect(btn.tooltip).toMatch(/Acting as/)
        })
      })
    })
  })
})
