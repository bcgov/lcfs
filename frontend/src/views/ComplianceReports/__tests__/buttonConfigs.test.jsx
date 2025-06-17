import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DateTime } from 'luxon'
import { buttonClusterConfigFn } from '../buttonConfigs'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { roles } from '@/constants/roles'

describe('buttonClusterConfigFn', () => {
  let mockContext

  beforeEach(() => {
    // Reset mock context before each test
    mockContext = {
      // Mock translation function
      t: vi.fn((key) => key),

      // Mock role checking functions
      hasAnyRole: vi.fn(),
      hasRoles: vi.fn(),

      // Mock handlers
      setModalData: vi.fn(),
      updateComplianceReport: vi.fn(),
      deleteComplianceReport: vi.fn(),
      createSupplementalReport: vi.fn(),
      createIdirSupplementalReport: vi.fn(),
      createAnalystAdjustment: vi.fn(),

      // Default report properties
      currentStatus: COMPLIANCE_REPORT_STATUSES.DRAFT,
      isSigningAuthorityDeclared: true,
      hasDraftSupplemental: false,
      isEarlyIssuance: false,
      hadBeenAssessed: false,
      isAnalystAdjustment: false,
      isOriginalReport: true,
      reportVersion: 0,
      compliancePeriod: '2024'
    }
  })

  // =============================================================================
  // USER TYPE DETECTION TESTS
  // =============================================================================

  describe('User Type Detection', () => {
    it('should identify BCEID_USER correctly', () => {
      mockContext.hasAnyRole = vi.fn(() => false) // Not government user
      mockContext.hasRoles = vi.fn(() => false) // Not signing authority

      const result = buttonClusterConfigFn(mockContext)

      // BCeID user in draft status should only see deleteDraft button
      expect(result[COMPLIANCE_REPORT_STATUSES.DRAFT]).toHaveLength(1)
      expect(result[COMPLIANCE_REPORT_STATUSES.DRAFT][0].id).toBe(
        'delete-draft-btn'
      )
    })

    it('should identify BCEID_SIGNER correctly', () => {
      mockContext.hasAnyRole = vi.fn(() => false) // Not government user
      mockContext.hasRoles = vi.fn((role) => role === roles.signing_authority)

      const result = buttonClusterConfigFn(mockContext)

      // BCeID signer in draft status should see submitReport and deleteDraft
      expect(result[COMPLIANCE_REPORT_STATUSES.DRAFT]).toHaveLength(2)
      const buttonIds = result[COMPLIANCE_REPORT_STATUSES.DRAFT].map(
        (btn) => btn.id
      )
      expect(buttonIds).toContain('submit-report-btn')
      expect(buttonIds).toContain('delete-draft-btn')
    })

    it('should identify IDIR_MANAGER correctly', () => {
      mockContext.hasAnyRole = vi.fn(() => true) // Government user
      mockContext.hasRoles = vi.fn((role) => role === roles.compliance_manager)
      mockContext.currentStatus =
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST

      const result = buttonClusterConfigFn(mockContext)

      // Manager should see manager actions
      expect(
        result[COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST]
      ).toHaveLength(2)
      const buttonIds = result[
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST
      ].map((btn) => btn.id)
      expect(buttonIds).toContain('recommend-by-manager-btn')
      expect(buttonIds).toContain('return-to-analyst-btn')
    })

    it('should identify IDIR_DIRECTOR correctly', () => {
      mockContext.hasAnyRole = vi.fn(() => true) // Government user
      mockContext.hasRoles = vi.fn((role) => role === roles.director)
      mockContext.currentStatus =
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER

      const result = buttonClusterConfigFn(mockContext)

      // Director should see director actions
      expect(
        result[COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER]
      ).toHaveLength(2)
      const buttonIds = result[
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
      ].map((btn) => btn.id)
      expect(buttonIds).toContain('issue-assessment-btn')
      expect(buttonIds).toContain('return-to-manager-btn')
    })
  })

  // =============================================================================
  // BUTTON CONFIGURATION BY STATUS TESTS
  // =============================================================================

  describe('Draft Status', () => {
    beforeEach(() => {
      mockContext.currentStatus = COMPLIANCE_REPORT_STATUSES.DRAFT
    })

    it('should show correct buttons for BCeID user in draft', () => {
      mockContext.hasAnyRole = vi.fn(() => false)
      mockContext.hasRoles = vi.fn(() => false)

      const result = buttonClusterConfigFn(mockContext)

      expect(result[COMPLIANCE_REPORT_STATUSES.DRAFT]).toHaveLength(1)
      expect(result[COMPLIANCE_REPORT_STATUSES.DRAFT][0].id).toBe(
        'delete-draft-btn'
      )
    })

    it('should show correct buttons for BCeID signer in draft', () => {
      mockContext.hasAnyRole = vi.fn(() => false)
      mockContext.hasRoles = vi.fn((role) => role === roles.signing_authority)

      const result = buttonClusterConfigFn(mockContext)

      expect(result[COMPLIANCE_REPORT_STATUSES.DRAFT]).toHaveLength(2)
      const buttonIds = result[COMPLIANCE_REPORT_STATUSES.DRAFT].map(
        (btn) => btn.id
      )
      expect(buttonIds).toContain('submit-report-btn')
      expect(buttonIds).toContain('delete-draft-btn')
    })

    it('should disable submit button when signing authority not declared', () => {
      mockContext.hasAnyRole = vi.fn(() => false)
      mockContext.hasRoles = vi.fn((role) => role === roles.signing_authority)
      mockContext.isSigningAuthorityDeclared = false

      const result = buttonClusterConfigFn(mockContext)

      const submitButton = result[COMPLIANCE_REPORT_STATUSES.DRAFT].find(
        (btn) => btn.id === 'submit-report-btn'
      )
      expect(submitButton.disabled).toBe(true)
    })

    it('should not show delete draft for IDIR users in draft', () => {
      mockContext.hasAnyRole = vi.fn(() => true)
      mockContext.hasRoles = vi.fn((role) => role === roles.analyst)

      const result = buttonClusterConfigFn(mockContext)

      expect(result[COMPLIANCE_REPORT_STATUSES.DRAFT]).toHaveLength(0)
    })
  })

  describe('Submitted Status', () => {
    beforeEach(() => {
      mockContext.currentStatus = COMPLIANCE_REPORT_STATUSES.SUBMITTED
      mockContext.hasAnyRole = vi.fn(() => true)
      mockContext.hasRoles = vi.fn((role) => role === roles.analyst)
    })

    it('should show analyst actions for submitted report before March 31 deadline', () => {
      // Set up scenario: original report before deadline
      mockContext.isOriginalReport = true
      mockContext.reportVersion = 0
      mockContext.compliancePeriod = '2024'

      // Mock current time to be before March 31, 2025 deadline
      vi.spyOn(DateTime, 'now').mockReturnValue(
        DateTime.fromObject({
          year: 2025,
          month: 2, // February - before March 31
          day: 15
        })
      )

      const result = buttonClusterConfigFn(mockContext)

      expect(result[COMPLIANCE_REPORT_STATUSES.SUBMITTED]).toHaveLength(2)
      const buttonIds = result[COMPLIANCE_REPORT_STATUSES.SUBMITTED].map(
        (btn) => btn.id
      )
      expect(buttonIds).toContain('recommend-by-analyst-btn')
      expect(buttonIds).toContain('return-to-supplier-btn')
      expect(buttonIds).not.toContain('create-idir-supplemental-btn')
    })

    it('should show analyst actions for submitted report after March 31 deadline', () => {
      // Set up scenario: original report after deadline
      mockContext.isOriginalReport = true
      mockContext.reportVersion = 0
      mockContext.compliancePeriod = '2024'

      // Mock current time to be after March 31, 2025 deadline
      vi.spyOn(DateTime, 'now').mockReturnValue(
        DateTime.fromObject({
          year: 2025,
          month: 4, // April - after March 31
          day: 15
        })
      )

      const result = buttonClusterConfigFn(mockContext)

      expect(result[COMPLIANCE_REPORT_STATUSES.SUBMITTED]).toHaveLength(2)
      const buttonIds = result[COMPLIANCE_REPORT_STATUSES.SUBMITTED].map(
        (btn) => btn.id
      )
      expect(buttonIds).toContain('recommend-by-analyst-btn')
      expect(buttonIds).toContain('create-idir-supplemental-btn')
      expect(buttonIds).not.toContain('return-to-supplier-btn')
    })

    it('should not show any buttons for BCeID users in submitted status', () => {
      mockContext.hasAnyRole = vi.fn(() => false)
      mockContext.hasRoles = vi.fn(() => false)

      const result = buttonClusterConfigFn(mockContext)

      expect(result[COMPLIANCE_REPORT_STATUSES.SUBMITTED]).toHaveLength(0)
    })
  })

  describe('Analyst Adjustment Status', () => {
    beforeEach(() => {
      mockContext.currentStatus = COMPLIANCE_REPORT_STATUSES.ANALYST_ADJUSTMENT
      mockContext.hasAnyRole = vi.fn(() => true)
      mockContext.hasRoles = vi.fn((role) => role === roles.analyst)
      mockContext.isAnalystAdjustment = true
    })

    it('should show analyst actions for analyst adjustment', () => {
      const result = buttonClusterConfigFn(mockContext)

      expect(
        result[COMPLIANCE_REPORT_STATUSES.ANALYST_ADJUSTMENT]
      ).toHaveLength(2)
      const buttonIds = result[
        COMPLIANCE_REPORT_STATUSES.ANALYST_ADJUSTMENT
      ].map((btn) => btn.id)
      expect(buttonIds).toContain('recommend-by-analyst-btn')
      expect(buttonIds).toContain('delete-analyst-adjustment-btn')
    })
  })

  describe('Assessed Status', () => {
    beforeEach(() => {
      mockContext.currentStatus = COMPLIANCE_REPORT_STATUSES.ASSESSED
    })

    it('should show no buttons for assessed status', () => {
      mockContext.hasAnyRole = vi.fn(() => false)
      mockContext.hasRoles = vi.fn(() => false)

      const result = buttonClusterConfigFn(mockContext)

      expect(result[COMPLIANCE_REPORT_STATUSES.ASSESSED]).toHaveLength(0)
    })
  })

  // =============================================================================
  // CONDITIONAL LOGIC TESTS
  // =============================================================================

  describe('Delete Draft Conditions', () => {
    beforeEach(() => {
      mockContext.currentStatus = COMPLIANCE_REPORT_STATUSES.DRAFT
      mockContext.hasAnyRole = vi.fn(() => false)
      mockContext.hasRoles = vi.fn(() => false)
    })

    it('should hide delete draft for early issuance if had been assessed', () => {
      mockContext.isEarlyIssuance = true
      mockContext.hadBeenAssessed = true

      const result = buttonClusterConfigFn(mockContext)

      expect(result[COMPLIANCE_REPORT_STATUSES.DRAFT]).toHaveLength(0)
    })

    it('should show delete draft for early issuance if not assessed', () => {
      mockContext.isEarlyIssuance = true
      mockContext.hadBeenAssessed = false

      const result = buttonClusterConfigFn(mockContext)

      expect(result[COMPLIANCE_REPORT_STATUSES.DRAFT]).toHaveLength(1)
      expect(result[COMPLIANCE_REPORT_STATUSES.DRAFT][0].id).toBe(
        'delete-draft-btn'
      )
    })
  })

  describe('Return to Supplier Conditions', () => {
    beforeEach(() => {
      mockContext.currentStatus = COMPLIANCE_REPORT_STATUSES.SUBMITTED
      mockContext.hasAnyRole = vi.fn(() => true)
      mockContext.hasRoles = vi.fn((role) => role === roles.analyst)
      mockContext.isOriginalReport = true
      mockContext.reportVersion = 0
    })

    it('should show return to supplier before March 31 deadline', () => {
      // Mock current time to be before deadline
      const pastYear = new Date().getFullYear() - 1
      mockContext.compliancePeriod = pastYear.toString()

      vi.spyOn(DateTime, 'now').mockReturnValue(
        DateTime.fromObject({
          year: pastYear + 1,
          month: 2, // February - before March 31
          day: 15
        })
      )

      const result = buttonClusterConfigFn(mockContext)

      const buttonIds = result[COMPLIANCE_REPORT_STATUSES.SUBMITTED].map(
        (btn) => btn.id
      )
      expect(buttonIds).toContain('return-to-supplier-btn')
      expect(buttonIds).not.toContain('create-idir-supplemental-btn')
    })

    it('should hide return to supplier after March 31 deadline', () => {
      // Mock current time to be after deadline
      const pastYear = new Date().getFullYear() - 1
      mockContext.compliancePeriod = pastYear.toString()

      vi.spyOn(DateTime, 'now').mockReturnValue(
        DateTime.fromObject({
          year: pastYear + 1,
          month: 4, // April - after March 31
          day: 15
        })
      )

      const result = buttonClusterConfigFn(mockContext)

      const buttonIds = result[COMPLIANCE_REPORT_STATUSES.SUBMITTED].map(
        (btn) => btn.id
      )
      expect(buttonIds).not.toContain('return-to-supplier-btn')
      expect(buttonIds).toContain('create-idir-supplemental-btn')
    })
  })

  describe('IDIR Supplemental Conditions', () => {
    beforeEach(() => {
      mockContext.currentStatus = COMPLIANCE_REPORT_STATUSES.SUBMITTED
      mockContext.hasAnyRole = vi.fn(() => true)
      mockContext.hasRoles = vi.fn((role) => role === roles.analyst)
      mockContext.isOriginalReport = true
      mockContext.reportVersion = 0
    })

    it('should show create IDIR supplemental after March 31 deadline', () => {
      const pastYear = new Date().getFullYear() - 1
      mockContext.compliancePeriod = pastYear.toString()

      vi.spyOn(DateTime, 'now').mockReturnValue(
        DateTime.fromObject({
          year: pastYear + 1,
          month: 4, // April - after March 31
          day: 15
        })
      )

      const result = buttonClusterConfigFn(mockContext)

      const buttonIds = result[COMPLIANCE_REPORT_STATUSES.SUBMITTED].map(
        (btn) => btn.id
      )
      expect(buttonIds).toContain('create-idir-supplemental-btn')
    })

    it('should not show create IDIR supplemental for non-original reports', () => {
      mockContext.isOriginalReport = false

      const result = buttonClusterConfigFn(mockContext)

      const buttonIds = result[COMPLIANCE_REPORT_STATUSES.SUBMITTED].map(
        (btn) => btn.id
      )
      expect(buttonIds).not.toContain('create-idir-supplemental-btn')
    })
  })

  describe('Analyst Adjustment Delete Conditions', () => {
    beforeEach(() => {
      mockContext.currentStatus = COMPLIANCE_REPORT_STATUSES.ANALYST_ADJUSTMENT
      mockContext.hasAnyRole = vi.fn(() => true)
      mockContext.hasRoles = vi.fn((role) => role === roles.analyst)
    })

    it('should show delete analyst adjustment when isAnalystAdjustment is true', () => {
      mockContext.isAnalystAdjustment = true

      const result = buttonClusterConfigFn(mockContext)

      const buttonIds = result[
        COMPLIANCE_REPORT_STATUSES.ANALYST_ADJUSTMENT
      ].map((btn) => btn.id)
      expect(buttonIds).toContain('delete-analyst-adjustment-btn')
    })

    it('should hide delete analyst adjustment when isAnalystAdjustment is false', () => {
      mockContext.isAnalystAdjustment = false

      const result = buttonClusterConfigFn(mockContext)

      const buttonIds = result[
        COMPLIANCE_REPORT_STATUSES.ANALYST_ADJUSTMENT
      ].map((btn) => btn.id)
      expect(buttonIds).not.toContain('delete-analyst-adjustment-btn')
    })
  })

  // =============================================================================
  // BUTTON PROPERTY TESTS
  // =============================================================================

  describe('Button Properties', () => {
    beforeEach(() => {
      mockContext.currentStatus = COMPLIANCE_REPORT_STATUSES.DRAFT
      mockContext.hasAnyRole = vi.fn(() => false)
      mockContext.hasRoles = vi.fn((role) => role === roles.signing_authority)
    })

    it('should create buttons with correct properties', () => {
      const result = buttonClusterConfigFn(mockContext)

      const submitButton = result[COMPLIANCE_REPORT_STATUSES.DRAFT].find(
        (btn) => btn.id === 'submit-report-btn'
      )

      expect(submitButton).toMatchObject({
        variant: 'contained',
        color: 'primary',
        id: 'submit-report-btn',
        label: 'report:actionBtns.submitReportBtn',
        disabled: false
      })
      expect(submitButton.handler).toBeInstanceOf(Function)
    })

    it('should disable buttons based on conditions', () => {
      mockContext.hasDraftSupplemental = true
      mockContext.currentStatus = COMPLIANCE_REPORT_STATUSES.SUBMITTED
      mockContext.hasAnyRole = vi.fn(() => true)
      mockContext.hasRoles = vi.fn((role) => role === roles.analyst)

      const result = buttonClusterConfigFn(mockContext)

      const recommendButton = result[COMPLIANCE_REPORT_STATUSES.SUBMITTED].find(
        (btn) => btn.id === 'recommend-by-analyst-btn'
      )
      expect(recommendButton.disabled).toBe(true)
    })
  })

  // =============================================================================
  // BUTTON HANDLER TESTS
  // =============================================================================

  describe('Button Handlers', () => {
    beforeEach(() => {
      mockContext.currentStatus = COMPLIANCE_REPORT_STATUSES.DRAFT
      mockContext.hasAnyRole = vi.fn(() => false)
      mockContext.hasRoles = vi.fn((role) => role === roles.signing_authority)
    })

    it('should call setModalData when button handler is executed', () => {
      const result = buttonClusterConfigFn(mockContext)

      const submitButton = result[COMPLIANCE_REPORT_STATUSES.DRAFT].find(
        (btn) => btn.id === 'submit-report-btn'
      )
      const formData = { test: 'data' }

      submitButton.handler(formData)

      expect(mockContext.setModalData).toHaveBeenCalledWith(
        expect.objectContaining({
          primaryButtonText: 'report:actionBtns.submitReportBtn',
          secondaryButtonText: 'cancelBtn',
          title: 'confirmation',
          content: 'report:submitConfirmText'
        })
      )
    })

    it('should configure delete button with error color', () => {
      mockContext.currentStatus = COMPLIANCE_REPORT_STATUSES.DRAFT
      mockContext.hasAnyRole = vi.fn(() => false)
      mockContext.hasRoles = vi.fn(() => false)

      const result = buttonClusterConfigFn(mockContext)

      const deleteButton = result[COMPLIANCE_REPORT_STATUSES.DRAFT].find(
        (btn) => btn.id === 'delete-draft-btn'
      )

      expect(deleteButton).toMatchObject({
        variant: 'outlined',
        color: 'error',
        id: 'delete-draft-btn'
      })

      // Test handler
      deleteButton.handler({ test: 'data' })
      expect(mockContext.setModalData).toHaveBeenCalledWith(
        expect.objectContaining({
          primaryButtonColor: 'error'
        })
      )
    })
  })

  // =============================================================================
  // EDGE CASES AND ERROR HANDLING
  // =============================================================================

  describe('Edge Cases', () => {
    it('should handle unknown status gracefully', () => {
      mockContext.currentStatus = 'UNKNOWN_STATUS'
      mockContext.hasAnyRole = vi.fn(() => false)

      const result = buttonClusterConfigFn(mockContext)

      expect(result.UNKNOWN_STATUS).toEqual([])
    })

    it('should handle missing button methods gracefully', () => {
      // This tests the optional chaining in actionFactory[buttonName]?.()
      mockContext.currentStatus = COMPLIANCE_REPORT_STATUSES.DRAFT
      mockContext.hasAnyRole = vi.fn(() => false)
      mockContext.hasRoles = vi.fn(() => false)

      // Should not throw error even if a button method doesn't exist
      expect(() => buttonClusterConfigFn(mockContext)).not.toThrow()
    })
  })

  // =============================================================================
  // INTEGRATION TESTS
  // =============================================================================

  describe('Integration Tests', () => {
    it('should handle complex scenario with multiple conditions', () => {
      // Early issuance, original report, analyst user, before deadline
      mockContext.currentStatus = COMPLIANCE_REPORT_STATUSES.SUBMITTED
      mockContext.hasAnyRole = vi.fn(() => true)
      mockContext.hasRoles = vi.fn((role) => role === roles.analyst)
      mockContext.isEarlyIssuance = true
      mockContext.isOriginalReport = true
      mockContext.reportVersion = 0
      mockContext.hadBeenAssessed = false
      mockContext.compliancePeriod = '2024'

      // Mock to be before deadline
      vi.spyOn(DateTime, 'now').mockReturnValue(
        DateTime.fromObject({
          year: 2025,
          month: 2,
          day: 15
        })
      )

      const result = buttonClusterConfigFn(mockContext)

      const buttonIds = result[COMPLIANCE_REPORT_STATUSES.SUBMITTED].map(
        (btn) => btn.id
      )
      expect(buttonIds).toContain('recommend-by-analyst-btn')
      expect(buttonIds).toContain('return-to-supplier-btn')
      expect(buttonIds).not.toContain('create-idir-supplemental-btn')
    })
  })
})
