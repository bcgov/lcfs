import { faPencil, faTrash } from '@fortawesome/free-solid-svg-icons'
import { DateTime } from 'luxon'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { roles, govRoles, nonGovRoles } from '@/constants/roles'

/**
 *
 * This system manages button visibility based on:
 * - Current report status (single source of truth)
 * - User roles and permissions
 * - Report metadata (version, type, etc.)
 * - Business rules and time constraints
 */

// =============================================================================
// USER TYPE DETECTION
// =============================================================================

const USER_TYPES = {
  BCEID_USER: 'bceid_user',
  BCEID_SIGNER: 'bceid_signer',
  IDIR_ANALYST: 'idir_analyst',
  IDIR_MANAGER: 'idir_manager',
  IDIR_DIRECTOR: 'idir_director'
}

function getUserType(context) {
  const isGovernmentUser = context.hasAnyRole && context.hasAnyRole(...govRoles)

  if (isGovernmentUser) {
    if (context.hasRoles && context.hasRoles(roles.director))
      return USER_TYPES.IDIR_DIRECTOR
    if (context.hasRoles && context.hasRoles(roles.compliance_manager))
      return USER_TYPES.IDIR_MANAGER
    if (context.hasRoles && context.hasRoles(roles.analyst))
      return USER_TYPES.IDIR_ANALYST
    return USER_TYPES.IDIR_ANALYST
  } else {
    if (context.hasRoles && context.hasRoles(roles.signing_authority))
      return USER_TYPES.BCEID_SIGNER
    return USER_TYPES.BCEID_USER
  }
}

// =============================================================================
// BUTTON STYLES
// =============================================================================

const BUTTON_STYLES = {
  PRIMARY_CONTAINED: { variant: 'contained', color: 'primary' },
  PRIMARY_OUTLINED: { variant: 'outlined', color: 'primary' },
  ERROR_OUTLINED: { variant: 'outlined', color: 'error' },
  WARNING_OUTLINED: { variant: 'outlined', color: 'warning' }
}

// =============================================================================
// BUTTON ACTION FACTORY
// =============================================================================

class ButtonActionFactory {
  constructor(context) {
    this.context = context
  }

  createButton(config) {
    return {
      ...config.style,
      id: config.id,
      label: config.label,
      startIcon: config.icon,
      disabled: config.disabled || false,
      handler: config.handler
    }
  }

  // BCeID Actions
  submitReport() {
    return this.createButton({
      style: BUTTON_STYLES.PRIMARY_CONTAINED,
      id: 'submit-report-btn',
      label: this.context.t('report:actionBtns.submitReportBtn'),
      icon: faPencil,
      disabled: !this.context.isSigningAuthorityDeclared,
      handler: (formData) =>
        this.context.setModalData({
          primaryButtonAction: () =>
            this.context.updateComplianceReport({
              ...formData,
              status: COMPLIANCE_REPORT_STATUSES.SUBMITTED
            }),
          primaryButtonText: this.context.t(
            'report:actionBtns.submitReportBtn'
          ),
          secondaryButtonText: this.context.t('cancelBtn'),
          title: this.context.t('confirmation'),
          content: this.context.t('report:submitConfirmText')
        })
    })
  }

  deleteDraft() {
    return this.createButton({
      style: BUTTON_STYLES.ERROR_OUTLINED,
      id: 'delete-draft-btn',
      label: this.context.t('report:actionBtns.deleteDraft'),
      icon: faTrash,
      disabled: this.cannotDeleteDraft(),
      handler: (formData) =>
        this.context.setModalData({
          primaryButtonAction: () =>
            this.context.deleteComplianceReport(formData),
          primaryButtonText: this.context.t('report:actionBtns.deleteDraft'),
          primaryButtonColor: 'error',
          secondaryButtonText: this.context.t('cancelBtn'),
          title: this.context.t('confirmation'),
          content: this.context.t('report:deleteConfirmText')
        })
    })
  }

  createSupplemental() {
    return this.createButton({
      style: BUTTON_STYLES.PRIMARY_OUTLINED,
      id: 'create-supplemental-btn',
      label: this.context.t('report:actionBtns.createSupplementalReportBtn'),
      disabled: this.context.hasDraftSupplemental,
      handler: (formData) =>
        this.context.setModalData({
          primaryButtonAction: () =>
            this.context.createSupplementalReport(formData),
          primaryButtonText: this.context.t(
            'report:actionBtns.createSupplementalReportBtn'
          ),
          secondaryButtonText: this.context.t('cancelBtn'),
          title: this.context.t('confirmation'),
          content: this.context.t('report:createSupplementalConfirmText')
        })
    })
  }

  // IDIR Analyst Actions
  recommendByAnalyst() {
    return this.createButton({
      style: BUTTON_STYLES.PRIMARY_CONTAINED,
      id: 'recommend-by-analyst-btn',
      label: this.context.t('report:actionBtns.recommendReportAnalystBtn'),
      handler: (formData) =>
        this.context.setModalData({
          primaryButtonAction: () =>
            this.context.updateComplianceReport({
              ...formData,
              status: COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST
            }),
          primaryButtonText: this.context.t(
            'report:actionBtns.recommendReportAnalystBtn'
          ),
          secondaryButtonText: this.context.t('cancelBtn'),
          title: this.context.t('confirmation'),
          content: this.context.t('report:recommendConfirmText')
        })
    })
  }

  returnToSupplier() {
    return this.createButton({
      style: BUTTON_STYLES.PRIMARY_OUTLINED,
      id: 'return-to-supplier-btn',
      label: this.context.t('report:actionBtns.returnToSupplier'),
      handler: (formData) =>
        this.context.setModalData({
          primaryButtonAction: () =>
            this.context.updateComplianceReport({
              ...formData,
              status: COMPLIANCE_REPORT_STATUSES.RETURN_TO_SUPPLIER
            }),
          primaryButtonText: this.context.t(
            'report:actionBtns.returnToSupplier'
          ),
          secondaryButtonText: this.context.t('cancelBtn'),
          title: this.context.t('confirmation'),
          content: this.context.t('report:returnToSupplierConfirmText')
        })
    })
  }

  createIdirSupplemental() {
    return this.createButton({
      style: BUTTON_STYLES.PRIMARY_OUTLINED,
      id: 'create-idir-supplemental-btn',
      label: this.context.t('report:actionBtns.createSupplementalReportBtn'),
      handler: (formData) =>
        this.context.setModalData({
          primaryButtonAction: () =>
            this.context.createIdirSupplementalReport(formData),
          primaryButtonText: this.context.t(
            'report:actionBtns.createSupplementalReportBtn'
          ),
          secondaryButtonText: this.context.t('cancelBtn'),
          title: this.context.t('confirmation'),
          content: this.context.t('report:createIdirSupplementalConfirmText')
        })
    })
  }

  governmentAdjustment() {
    return this.createButton({
      style: BUTTON_STYLES.WARNING_OUTLINED,
      id: 'government-adjustment-btn',
      label: this.context.t('report:actionBtns.governmentAdjustment'),
      handler: (formData) =>
        this.context.setModalData({
          primaryButtonAction: () =>
            this.context.createAnalystAdjustment(formData),
          primaryButtonText: this.context.t(
            'report:actionBtns.governmentAdjustment'
          ),
          secondaryButtonText: this.context.t('cancelBtn'),
          title: this.context.t('confirmation'),
          content: this.context.t('report:governmentAdjustmentConfirmText')
        })
    })
  }

  createReassessment() {
    return this.createButton({
      style: BUTTON_STYLES.WARNING_OUTLINED,
      id: 'create-reassessment-btn',
      label: this.context.t('report:actionBtns.createReassessment'),
      handler: (formData) =>
        this.context.setModalData({
          primaryButtonAction: () =>
            this.context.createAnalystAdjustment(formData),
          primaryButtonText: this.context.t(
            'report:actionBtns.createReassessment'
          ),
          secondaryButtonText: this.context.t('cancelBtn'),
          title: this.context.t('confirmation'),
          content: this.context.t('report:createReassessmentConfirmText')
        })
    })
  }

  deleteAnalystAdjustment() {
    return this.createButton({
      style: BUTTON_STYLES.ERROR_OUTLINED,
      id: 'delete-analyst-adjustment-btn',
      label: this.context.t('report:actionBtns.deleteAnalystAdjustmentBtn'),
      icon: faTrash,
      handler: (formData) =>
        this.context.setModalData({
          primaryButtonAction: () =>
            this.context.deleteComplianceReport(formData),
          primaryButtonText: this.context.t(
            'report:actionBtns.deleteAnalystAdjustmentBtn'
          ),
          primaryButtonColor: 'error',
          secondaryButtonText: this.context.t('cancelBtn'),
          title: this.context.t('confirmation'),
          content: this.context.t('report:deleteConfirmText')
        })
    })
  }
  // TODO: yet to implement
  // nonAssessment() {
  //   return this.createButton({
  //     style: BUTTON_STYLES.PRIMARY_OUTLINED,
  //     id: 'non-assessment-btn',
  //     label: this.context.t('report:actionBtns.nonAssessment'),
  //     handler: (formData) =>
  //       this.context.setModalData({
  //         primaryButtonAction: () =>
  //           this.context.updateComplianceReport({
  //             ...formData,
  //             status: COMPLIANCE_REPORT_STATUSES.ASSESSED
  //           }),
  //         primaryButtonText: this.context.t('report:actionBtns.nonAssessment'),
  //         secondaryButtonText: this.context.t('cancelBtn'),
  //         title: this.context.t('confirmation'),
  //         content: this.context.t('report:nonAssessmentConfirmText')
  //       })
  //   })
  // }

  // IDIR Manager Actions
  recommendByManager() {
    return this.createButton({
      style: BUTTON_STYLES.PRIMARY_CONTAINED,
      id: 'recommend-by-manager-btn',
      label: this.context.t('report:actionBtns.recommendReportManagerBtn'),
      handler: (formData) =>
        this.context.setModalData({
          primaryButtonAction: () =>
            this.context.updateComplianceReport({
              ...formData,
              status: COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
            }),
          primaryButtonText: this.context.t(
            'report:actionBtns.recommendReportManagerBtn'
          ),
          secondaryButtonText: this.context.t('cancelBtn'),
          title: this.context.t('confirmation'),
          content: this.context.t('report:recommendConfirmText')
        })
    })
  }

  returnToAnalyst() {
    return this.createButton({
      style: BUTTON_STYLES.PRIMARY_OUTLINED,
      id: 'return-to-analyst-btn',
      label: this.context.t('report:actionBtns.returnToAnalyst'),
      handler: (formData) =>
        this.context.setModalData({
          primaryButtonAction: () =>
            this.context.updateComplianceReport({
              ...formData,
              status: COMPLIANCE_REPORT_STATUSES.RETURN_TO_ANALYST
            }),
          primaryButtonText: this.context.t(
            'report:actionBtns.returnToAnalyst'
          ),
          secondaryButtonText: this.context.t('cancelBtn'),
          title: this.context.t('confirmation'),
          content: this.context.t('report:returnToAnalystConfirmText')
        })
    })
  }

  // IDIR Director Actions
  issueAssessment() {
    return this.createButton({
      style: BUTTON_STYLES.PRIMARY_CONTAINED,
      id: 'issue-assessment-btn',
      label: this.context.t('report:actionBtns.assessReportBtn'),
      handler: (formData) =>
        this.context.setModalData({
          primaryButtonAction: () =>
            this.context.updateComplianceReport({
              ...formData,
              status: COMPLIANCE_REPORT_STATUSES.ASSESSED
            }),
          primaryButtonText: this.context.t(
            'report:actionBtns.assessReportBtn'
          ),
          secondaryButtonText: this.context.t('cancelBtn'),
          title: this.context.t('confirmation'),
          content: this.context.t('report:assessConfirmText')
        })
    })
  }

  returnToManager() {
    return this.createButton({
      style: BUTTON_STYLES.PRIMARY_OUTLINED,
      id: 'return-to-manager-btn',
      label: this.context.t('report:actionBtns.returnToManager'),
      handler: (formData) =>
        this.context.setModalData({
          primaryButtonAction: () =>
            this.context.updateComplianceReport({
              ...formData,
              status: COMPLIANCE_REPORT_STATUSES.RETURN_TO_MANAGER
            }),
          primaryButtonText: this.context.t(
            'report:actionBtns.returnToManager'
          ),
          secondaryButtonText: this.context.t('cancelBtn'),
          title: this.context.t('confirmation'),
          content: this.context.t('report:returnToManagerConfirmText')
        })
    })
  }
  // TODO: yet to implement
  // amendPenalties() {
  //   return this.createButton({
  //     style: BUTTON_STYLES.WARNING_OUTLINED,
  //     id: 'amend-penalties-btn',
  //     label: this.context.t('report:actionBtns.amendPenalties'),
  //     handler: (formData) =>
  //       this.context.setModalData({
  //         primaryButtonAction: () => this.context.amendPenalties(formData),
  //         primaryButtonText: this.context.t('report:actionBtns.amendPenalties'),
  //         secondaryButtonText: this.context.t('cancelBtn'),
  //         title: this.context.t('confirmation'),
  //         content: this.context.t('report:amendPenaltiesConfirmText')
  //       })
  //   })
  // }

  // Helper methods
  cannotDeleteDraft() {
    // For early issuance: only until first early issuance has been assessed
    if (this.context.isEarlyIssuance) {
      return this.context.hadBeenAssessed
    }
    return false
  }
}

// =============================================================================
// SIMPLIFIED BUTTON CONFIGURATION RULES
// =============================================================================

const BUTTON_RULES = {
  [COMPLIANCE_REPORT_STATUSES.DRAFT]: {
    [USER_TYPES.BCEID_USER]: ['deleteDraft'],
    [USER_TYPES.BCEID_SIGNER]: ['submitReport', 'deleteDraft'],
    [USER_TYPES.IDIR_ANALYST]: [],
    [USER_TYPES.IDIR_MANAGER]: [],
    [USER_TYPES.IDIR_DIRECTOR]: []
  },

  [COMPLIANCE_REPORT_STATUSES.SUBMITTED]: {
    [USER_TYPES.BCEID_USER]: [],
    [USER_TYPES.BCEID_SIGNER]: [],
    [USER_TYPES.IDIR_ANALYST]: [
      'recommendByAnalyst',
      'returnToSupplier',
      'createIdirSupplemental'
      // 'governmentAdjustment', /* visible to the user thru AssessmentRecommendation Card */.
      // 'nonAssessment' // TODO: yet to implement logic
    ],
    [USER_TYPES.IDIR_MANAGER]: [],
    [USER_TYPES.IDIR_DIRECTOR]: []
  },

  [COMPLIANCE_REPORT_STATUSES.ANALYST_ADJUSTMENT]: {
    [USER_TYPES.BCEID_USER]: [],
    [USER_TYPES.BCEID_SIGNER]: [],
    [USER_TYPES.IDIR_ANALYST]: [
      'recommendByAnalyst',
      'deleteAnalystAdjustment'
    ],
    [USER_TYPES.IDIR_MANAGER]: [],
    [USER_TYPES.IDIR_DIRECTOR]: []
  },

  [COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST]: {
    [USER_TYPES.BCEID_USER]: [],
    [USER_TYPES.BCEID_SIGNER]: [],
    [USER_TYPES.IDIR_ANALYST]: [],
    [USER_TYPES.IDIR_MANAGER]: ['recommendByManager', 'returnToAnalyst'],
    [USER_TYPES.IDIR_DIRECTOR]: ['issueAssessment', 'returnToAnalyst']
  },

  [COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER]: {
    [USER_TYPES.BCEID_USER]: [],
    [USER_TYPES.BCEID_SIGNER]: [],
    [USER_TYPES.IDIR_ANALYST]: [],
    [USER_TYPES.IDIR_MANAGER]: [],
    [USER_TYPES.IDIR_DIRECTOR]: [
      'issueAssessment',
      'returnToManager'
      // 'amendPenalties' /* TODO: yet to implement */
    ]
  },

  [COMPLIANCE_REPORT_STATUSES.ASSESSED]: {
    [USER_TYPES.BCEID_USER]: [], // 'createSupplemental' is available directly in AssessmentCard
    [USER_TYPES.BCEID_SIGNER]: [], // 'createSupplemental' is available directly in AssessmentCard
    [USER_TYPES.IDIR_ANALYST]: [], // 'createSupplemental' is available directly in AssessmentRecommendation
    [USER_TYPES.IDIR_MANAGER]: [],
    [USER_TYPES.IDIR_DIRECTOR]: []
  }
}

// =============================================================================
// CONDITION CHECKING
// =============================================================================

function shouldShowButton(buttonName, context) {
  // Check for draft supplemental conflicts first for buttons that would be disabled
  const buttonsDisabledByDraftSupplemental = [
    'recommendByAnalyst',
    'returnToSupplier',
    'createIdirSupplemental',
    'createReassessment',
    'recommendByManager',
    'returnToAnalyst',
    'issueAssessment',
    'returnToManager'
  ]

  if (
    buttonsDisabledByDraftSupplemental.includes(buttonName) &&
    context.hasDraftSupplemental
  ) {
    return false
  }

  switch (buttonName) {
    case 'deleteDraft':
      // For early issuance: only until first early issuance has been assessed
      if (context.isEarlyIssuance && context.hadBeenAssessed) {
        return false
      }
      return true

    case 'deleteAnalystAdjustment':
      // Only show for analyst adjustments in draft
      return context.isAnalystAdjustment

    case 'returnToSupplier':
      // For original reports, show return to supplier before March 31 deadline
      if (context.isOriginalReport && context.reportVersion === 0) {
        return !isPastMarch31Deadline(context.compliancePeriod)
      }
      return true

    case 'createIdirSupplemental':
      // For original reports, show create supplemental after March 31 deadline
      if (context.isOriginalReport && context.reportVersion === 0) {
        return isPastMarch31Deadline(context.compliancePeriod)
      }
      return false

    case 'nonAssessment':
      // Only available on original compliance reports that have never been assessed
      return (
        context.isOriginalReport &&
        context.reportVersion === 0 &&
        !context.hadBeenAssessed
      )

    case 'amendPenalties':
      // Only available for original and supplemental reports
      return !context.isEarlyIssuance

    case 'createReassessment':
      // Additional condition: only show for specific conditions beyond draft supplemental check
      return true

    default:
      return true
  }
}

function isPastMarch31Deadline(compliancePeriod) {
  const compliancePeriodYear = parseInt(compliancePeriod)
  const deadline = DateTime.fromObject({
    year: compliancePeriodYear + 1,
    month: 3,
    day: 31
  })
  return DateTime.now() > deadline
}

// =============================================================================
// MAIN CONFIGURATION FUNCTION
// =============================================================================

export const buttonClusterConfigFn = (context) => {
  const actionFactory = new ButtonActionFactory(context)
  const userType = getUserType(context)
  const currentStatus = context.currentStatus

  // Get buttons for current status and user type
  const statusRules = BUTTON_RULES[currentStatus] || {}
  const userButtons = statusRules[userType] || []

  const buttons = []

  // Process each potential button
  for (const buttonName of userButtons) {
    // Check if button should be shown based on conditions
    if (!shouldShowButton(buttonName, context)) {
      continue
    }

    // Create the button
    const button = actionFactory[buttonName]?.()
    if (button) {
      buttons.push(button)
    }
  }

  return {
    [currentStatus]: buttons
  }
}
