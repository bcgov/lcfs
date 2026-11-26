import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import {
  buttonClusterConfigFn,
  type ButtonContext,
  type ConfiguredButton
} from '../buttonConfigs'
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
      day: 15,
      valueOf: () => new Date(2024, 5, 15).getTime()
    })),
    fromObject: vi.fn(() => ({
      toMillis: () => 1609459200000, // Jan 1, 2021
      valueOf: () => new Date(2026, 3, 1).getTime() // April 1, 2026 — always in the future
    }))
  }
}))

type MockedCallback<T extends (...args: never[]) => unknown> = ReturnType<
  typeof vi.fn<T>
>

type TestButtonContext = Omit<
  ButtonContext,
  | 'currentStatus'
  | 'reportVersion'
  | 'isEarlyIssuance'
  | 'isOriginalReport'
  | 'isAnalystAdjustment'
  | 'isNonAssessment'
  | 'hasDraftSupplemental'
  | 'hadBeenAssessed'
  | 'hasRoles'
  | 'hasAnyRole'
  | 't'
  | 'setModalData'
  | 'updateComplianceReport'
  | 'deleteComplianceReport'
  | 'createSupplementalReport'
  | 'createIdirSupplementalReport'
  | 'createAnalystAdjustment'
> & {
  currentStatus: string
  reportVersion: number
  isEarlyIssuance: boolean
  isOriginalReport: boolean
  isAnalystAdjustment: boolean
  isNonAssessment?: boolean | null | undefined
  hasDraftSupplemental: boolean
  hadBeenAssessed: boolean
  hasRoles: MockedCallback<NonNullable<ButtonContext['hasRoles']>>
  hasAnyRole: MockedCallback<NonNullable<ButtonContext['hasAnyRole']>>
  t: MockedCallback<ButtonContext['t']>
  setModalData: MockedCallback<ButtonContext['setModalData']>
  updateComplianceReport: MockedCallback<
    ButtonContext['updateComplianceReport']
  >
  deleteComplianceReport: MockedCallback<
    ButtonContext['deleteComplianceReport']
  >
  createSupplementalReport: MockedCallback<
    ButtonContext['createSupplementalReport']
  >
  createIdirSupplementalReport: MockedCallback<
    ButtonContext['createIdirSupplementalReport']
  >
  createAnalystAdjustment: MockedCallback<
    ButtonContext['createAnalystAdjustment']
  >
}

const createMockContext = (): TestButtonContext => {
  const translations: Record<string, string> = {
    'report:actionBtns.assessReportBtn': 'Issue assessment',
    'report:actionBtns.issueNonAssessmentBtn': 'Issue non-assessment',
    'report:actionBtns.nonAssessment': 'Non-assessment',
    'report:actionBtns.issueExemptionBtn': 'Issue exemption',
    'report:exemptConfirmText':
      'Are you sure you want to exempt this compliance report? This will finalize the report without issuing any compliance units.',
    confirmation: 'Confirmation',
    cancelBtn: 'Cancel',
    'report:assessConfirmText':
      'Are you sure you want to assess this compliance report?',
    'report:nonAssessmentConfirmText':
      'Are you sure you want to mark this compliance report as non-assessment? This will immediately assess the report without issuing any compliance units.'
  }
  return {
    currentStatus: String(COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER),
    hasRoles: vi.fn<NonNullable<ButtonContext['hasRoles']>>(),
    hasAnyRole: vi.fn<NonNullable<ButtonContext['hasAnyRole']>>(),
    t: vi.fn<ButtonContext['t']>((key) => translations[key] || key),
    setModalData: vi.fn<ButtonContext['setModalData']>(),
    reportVersion: Number(0),
    compliancePeriod: '2024',
    isSigningAuthorityDeclared: true,
    isEarlyIssuance: false,
    isOriginalReport: true,
    isAnalystAdjustment: false,
    isNonAssessment: false,
    supplementalInitiator: null as string | null,
    hasDraftSupplemental: false,
    hadBeenAssessed: false,
    updateComplianceReport: vi.fn<ButtonContext['updateComplianceReport']>(),
    deleteComplianceReport: vi.fn<ButtonContext['deleteComplianceReport']>(),
    createSupplementalReport:
      vi.fn<ButtonContext['createSupplementalReport']>(),
    createIdirSupplementalReport:
      vi.fn<ButtonContext['createIdirSupplementalReport']>(),
    createAnalystAdjustment: vi.fn<ButtonContext['createAnalystAdjustment']>(),
    amendPenalties: vi.fn<(data: Record<string, unknown>) => unknown>()
  }
}

const getButton = (buttons: ConfiguredButton[] | undefined, id: string) => {
  const button = buttons?.find((candidate) => candidate.id === id)
  if (!button) throw new Error(`Expected button ${id} to be available`)
  return button
}

describe('ComplianceReports buttonConfigs', () => {
  let mockContext: TestButtonContext

  it('submits supplier fields without government assessment defaults', () => {
    mockContext.currentStatus = COMPLIANCE_REPORT_STATUSES.DRAFT
    mockContext.hasRoles = vi.fn(
      (role: string) => role === roles.signing_authority
    )
    mockContext.hasAnyRole = vi.fn(() => false)
    mockContext.updateComplianceReport = vi.fn()
    const config = buttonClusterConfigFn(mockContext)
    const submit = getButton(
      config[COMPLIANCE_REPORT_STATUSES.DRAFT],
      'submit-report-btn'
    )
    submit.handler({
      supplementalNote: 'Supplier note',
      assessmentStatement: '',
      isNonAssessment: false,
      isRenewableFuelExempted: false,
      isLowCarbonFuelExempted: false
    })
    mockContext.setModalData.mock.calls[0][0].primaryButtonAction()
    expect(mockContext.updateComplianceReport).toHaveBeenCalledWith({
      supplementalNote: 'Supplier note',
      status: COMPLIANCE_REPORT_STATUSES.SUBMITTED
    })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockContext = createMockContext()
  })

  it.each([
    [null, true],
    ['Supplier Supplemental', true],
    ['Government Initiated', false],
    ['Government Reassessment', false]
  ])('shows delete for initiator %s: %s', (supplementalInitiator, visible) => {
    mockContext.currentStatus = COMPLIANCE_REPORT_STATUSES.DRAFT
    mockContext.hasRoles = vi.fn(
      (role: string) => role === roles.signing_authority
    )
    mockContext.hasAnyRole = vi.fn(() => false)
    mockContext.supplementalInitiator = supplementalInitiator
    const buttons =
      buttonClusterConfigFn(mockContext)[COMPLIANCE_REPORT_STATUSES.DRAFT]
    expect(buttons.some((button) => button.id === 'delete-draft-btn')).toBe(
      visible
    )
  })

  describe('issueAssessment Button Configuration', () => {
    beforeEach(() => {
      // Mock director role
      mockContext.hasRoles.mockImplementation((role: string) => {
        return role === roles.director
      })
      mockContext.hasAnyRole.mockImplementation((...roleList: string[]) => {
        return (
          roleList.includes(roles.director) ||
          roleList.some((role: string) =>
            govRoles.some((governmentRole) => governmentRole === role)
          )
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
      ].find((button) => button.id === 'issue-assessment-btn')!

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
      ].find((button) => button.id === 'issue-assessment-btn')!

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
      ].find((button) => button.id === 'issue-assessment-btn')!

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
      ].find((button) => button.id === 'issue-assessment-btn')!

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
      ].find((button) => button.id === 'issue-assessment-btn')!

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
      ].find((button) => button.id === 'issue-assessment-btn')!

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
      ].find((button) => button.id === 'issue-assessment-btn')!

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
      mockContext.hasRoles.mockImplementation((role: string) => {
        return role === roles.director
      })
      mockContext.hasAnyRole.mockImplementation((...roleList: string[]) => {
        return (
          roleList.includes(roles.director) ||
          roleList.some((role: string) =>
            govRoles.some((governmentRole) => governmentRole === role)
          )
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
      ].find((button) => button.id === 'issue-assessment-btn')!

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
      ].find((button) => button.id === 'issue-assessment-btn')!

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
      expect(
        buttons.some(
          (b) =>
            b.id === 'recommend-by-manager-btn' ||
            b.id === 'return-to-analyst-btn'
        )
      ).toBe(true)
    })

    it('should not show issueAssessment button when hasDraftSupplemental is true', () => {
      mockContext.currentStatus =
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
      mockContext.hasDraftSupplemental = true

      const config = buttonClusterConfigFn(mockContext)

      const issueAssessmentButton = config[
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
      ].find((button) => button.id === 'issue-assessment-btn')!

      expect(issueAssessmentButton).toBeUndefined()
    })
  })

  describe('Edge Cases', () => {
    beforeEach(() => {
      // Mock director role
      mockContext.hasRoles.mockImplementation((role: string) => {
        return role === roles.director
      })
      mockContext.hasAnyRole.mockImplementation((...roleList: string[]) => {
        return (
          roleList.includes(roles.director) ||
          roleList.some((role: string) =>
            govRoles.some((governmentRole) => governmentRole === role)
          )
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
      ].find((button) => button.id === 'issue-assessment-btn')!

      expect(issueAssessmentButton.label).toBe('Issue assessment')
    })

    it('should preserve all other button properties when label changes', () => {
      mockContext.isNonAssessment = true

      const config = buttonClusterConfigFn(mockContext)
      const issueAssessmentButton = config[
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
      ].find((button) => button.id === 'issue-assessment-btn')!

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
      mockContext.hasRoles.mockImplementation(
        (role: string) => role === roles.director
      )
      mockContext.hasAnyRole.mockImplementation((...roleList: string[]) =>
        roleList.includes(roles.director)
      )
    })

    describe('Director Acting as Analyst', () => {
      it('should show "Recommend to Director" button with correct tooltip for Director', () => {
        mockContext.currentStatus = COMPLIANCE_REPORT_STATUSES.SUBMITTED

        const config = buttonClusterConfigFn(mockContext)
        const recommendButton = config[
          COMPLIANCE_REPORT_STATUSES.SUBMITTED
        ].find((btn) => btn.id === 'recommend-by-analyst-btn')!

        expect(recommendButton).toBeDefined()
        expect(recommendButton.tooltip).toBe('Acting as Analyst')
        expect(recommendButton.roleIndicator).toBe('Analyst')
      })

      it('should show "Return to Supplier" button with correct tooltip for Director', () => {
        mockContext.currentStatus = COMPLIANCE_REPORT_STATUSES.SUBMITTED

        const config = buttonClusterConfigFn(mockContext)
        const returnButton = config[COMPLIANCE_REPORT_STATUSES.SUBMITTED].find(
          (btn) => btn.id === 'return-to-supplier-btn'
        )!

        expect(returnButton).toBeDefined()
        expect(returnButton.tooltip).toBe('Acting as Analyst')
        expect(returnButton.roleIndicator).toBe('Analyst')
      })

      it('should NOT show "Create Supplemental Report" button for Director', () => {
        mockContext.currentStatus = COMPLIANCE_REPORT_STATUSES.SUBMITTED

        const config = buttonClusterConfigFn(mockContext)
        const supplementalButton = config[
          COMPLIANCE_REPORT_STATUSES.SUBMITTED
        ].find((btn) => btn.id === 'create-idir-supplemental-btn')!

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
        ].find((btn) => btn.id === 'recommend-by-manager-btn')!

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
        ].find((btn) => btn.id === 'return-to-analyst-btn')!

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
        ].find((btn) => btn.id === 'issue-assessment-btn')!

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

    describe('Director on an Analyst adjustment', () => {
      beforeEach(() => {
        mockContext.currentStatus =
          COMPLIANCE_REPORT_STATUSES.ANALYST_ADJUSTMENT
        mockContext.isAnalystAdjustment = true
        mockContext.isOriginalReport = false
        mockContext.reportVersion = 1
      })

      const analystAdjustmentButtons = () =>
        buttonClusterConfigFn(mockContext)[
          COMPLIANCE_REPORT_STATUSES.ANALYST_ADJUSTMENT
        ]

      it('should offer Assess directly, next to Recommend acting as Analyst', () => {
        const buttons = analystAdjustmentButtons()

        expect(buttons.map((btn) => btn.id)).toEqual([
          'recommend-by-analyst-btn',
          'issue-assessment-btn'
        ])
        expect(
          buttons.find((btn) => btn.id === 'recommend-by-analyst-btn')!
            .roleIndicator
        ).toBe('Analyst')
        expect(
          buttons.find((btn) => btn.id === 'issue-assessment-btn')!
            .roleIndicator
        ).toBeFalsy()
      })

      it('should assess straight from Analyst adjustment', () => {
        const assessButton = analystAdjustmentButtons().find(
          (btn) => btn.id === 'issue-assessment-btn'
        )!
        const formData = { isNonAssessment: false }

        assessButton.handler(formData)
        mockContext.setModalData.mock.calls[0][0].primaryButtonAction()

        expect(mockContext.updateComplianceReport).toHaveBeenCalledWith({
          ...formData,
          status: COMPLIANCE_REPORT_STATUSES.ASSESSED
        })
      })

      it('should not offer Assess to an Analyst', () => {
        mockContext.hasRoles.mockImplementation(
          (role: string) => role === roles.analyst
        )
        mockContext.hasAnyRole.mockImplementation((...roleList: string[]) =>
          roleList.includes(roles.analyst)
        )

        const ids = analystAdjustmentButtons().map((btn) => btn.id)

        expect(ids).toContain('recommend-by-analyst-btn')
        expect(ids).not.toContain('issue-assessment-btn')
      })
    })

    describe('Button Grouping', () => {
      it('should separate Director buttons from delegated authority buttons', () => {
        // Use ANALYST_ADJUSTMENT status where director has both:
        // - recommendByAnalyst (Analyst role - has roleIndicator)
        // - issueAssessment (Director role - no roleIndicator)
        mockContext.currentStatus =
          COMPLIANCE_REPORT_STATUSES.ANALYST_ADJUSTMENT

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
