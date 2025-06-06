import { faPencil, faTrash } from '@fortawesome/free-solid-svg-icons'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { roles } from '@/constants/roles'
import { DateTime } from 'luxon'

const outlineBase = {
  variant: 'outlined',
  color: 'primary'
}

const containedBase = {
  variant: 'contained',
  color: 'primary'
}

const redBase = {
  variant: 'outlined',
  color: 'error'
}

export const redOutlinedButton = (label, startIcon) => ({
  ...redBase,
  label,
  startIcon
})

export const outlinedButton = (label, startIcon) => ({
  ...outlineBase,
  label,
  startIcon
})

export const containedButton = (label, startIcon) => ({
  ...containedBase,
  label,
  startIcon
})

export const buttonClusterConfigFn = ({
  hasRoles,
  t,
  setModalData,
  updateComplianceReport,
  createIdirSupplementalReport = () => {},
  deleteComplianceReport = () => {},
  compliancePeriod,
  isGovernmentUser,
  isSigningAuthorityDeclared,
  supplementalInitiator,
  hasDraftSupplemental,
  reportVersion,
  isSupplemental
}) => {
  const reportButtons = {
    submitReport: {
      ...containedButton(t('report:actionBtns.submitReportBtn'), faPencil),
      disabled:
        !hasRoles(roles.signing_authority) || !isSigningAuthorityDeclared,
      id: 'submit-report-btn',
      handler: (formData) => {
        setModalData({
          primaryButtonAction: () =>
            updateComplianceReport({
              ...formData,
              status: COMPLIANCE_REPORT_STATUSES.SUBMITTED
            }),
          primaryButtonText: t('report:actionBtns.submitReportBtn'),
          secondaryButtonText: t('cancelBtn'),
          title: t('confirmation'),
          content: t('report:submitConfirmText')
        })
      }
    },
    createIdirSupplementalReport: {
      ...outlinedButton(t('report:actionBtns.createSupplementalReportBtn')),
      id: 'create-idir-supplemental-report-btn',
      handler: (formData) => {
        setModalData({
          primaryButtonAction: () =>
            createIdirSupplementalReport({
              complianceReportId: formData.complianceReportId
            }),
          primaryButtonText: t('report:actionBtns.createSupplementalReportBtn'),
          secondaryButtonText: t('cancelBtn'),
          title: t('confirmation'),
          content: t('report:createIdirSupplementalConfirmText')
        })
      }
    },
    recommendByAnalyst: {
      ...containedButton(t('report:actionBtns.recommendReportAnalystBtn')),
      id: 'recommend-report-analyst-btn',
      handler: (formData) => {
        setModalData({
          primaryButtonAction: () =>
            updateComplianceReport({
              ...formData,
              status: COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST
            }),
          primaryButtonText: t('report:actionBtns.recommendReportAnalystBtn'),
          secondaryButtonText: t('cancelBtn'),
          title: t('confirmation'),
          content: t('report:recommendConfirmText')
        })
      }
    },
    recommendByManager: {
      ...containedButton(t('report:actionBtns.recommendReportManagerBtn')),
      id: 'recommend-report-manager-btn',
      handler: (formData) => {
        setModalData({
          primaryButtonAction: () =>
            updateComplianceReport({
              ...formData,
              status: COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
            }),
          primaryButtonText: t('report:actionBtns.recommendReportManagerBtn'),
          secondaryButtonText: t('cancelBtn'),
          title: t('confirmation'),
          content: t('report:recommendConfirmText')
        })
      }
    },
    returnToAnalyst: {
      ...outlinedButton(t('report:actionBtns.returnToAnalyst')),
      id: 'return-report-manager-btn',
      handler: (formData) => {
        setModalData({
          primaryButtonAction: () =>
            updateComplianceReport({
              ...formData,
              status: COMPLIANCE_REPORT_STATUSES.RETURN_TO_ANALYST
            }),
          primaryButtonText: t('report:actionBtns.returnToAnalyst'),
          secondaryButtonText: t('cancelBtn'),
          title: t('confirmation'),
          content: t('report:returnToAnalystConfirmText')
        })
      }
    },
    returnToManager: {
      ...outlinedButton(t('report:actionBtns.returnToManager')),
      id: 'return-report-manager-btn',
      handler: (formData) => {
        setModalData({
          primaryButtonAction: () =>
            updateComplianceReport({
              ...formData,
              status: COMPLIANCE_REPORT_STATUSES.RETURN_TO_MANAGER
            }),
          primaryButtonText: t('report:actionBtns.returnToManager'),
          secondaryButtonText: t('cancelBtn'),
          title: t('confirmation'),
          content: t('report:returnToManagerConfirmText')
        })
      }
    },
    returnToSupplier: {
      ...outlinedButton(t('report:actionBtns.returnToSupplier')),
      id: 'return-report-supplier-btn',
      handler: (formData) => {
        setModalData({
          primaryButtonAction: () =>
            updateComplianceReport({
              ...formData,
              status: COMPLIANCE_REPORT_STATUSES.RETURN_TO_SUPPLIER
            }),
          primaryButtonText: t('report:actionBtns.returnToSupplier'),
          secondaryButtonText: t('cancelBtn'),
          title: t('confirmation'),
          content: t('report:returnToSupplierConfirmText')
        })
      }
    },
    assessReport: {
      ...containedButton(t('report:actionBtns.assessReportBtn')),
      id: 'assess-report-btn',
      handler: (formData) => {
        setModalData({
          primaryButtonAction: () =>
            updateComplianceReport({
              ...formData,
              status: COMPLIANCE_REPORT_STATUSES.ASSESSED
            }),
          primaryButtonText: t('report:actionBtns.assessReportBtn'),
          secondaryButtonText: t('cancelBtn'),
          title: t('confirmation'),
          content: t('report:assessConfirmText')
        })
      }
    },
    deleteSupplementalReport: {
      ...redOutlinedButton(
        t('report:actionBtns.deleteSupplementalReportBtn'),
        faTrash
      ),
      id: 'delete-supplemental-report-btn',
      handler: (formData) => {
        setModalData({
          primaryButtonAction: () => deleteComplianceReport(formData),
          primaryButtonText: t('report:actionBtns.deleteSupplementalReportBtn'),
          primaryButtonColor: 'error',
          secondaryButtonText: t('cancelBtn'),
          title: t('confirmation'),
          content: t('report:deleteConfirmText')
        })
      }
    },
    deleteAnalystAdjustment: {
      ...redOutlinedButton(
        t('report:actionBtns.deleteAnalystAdjustmentBtn'),
        faTrash
      ),
      id: 'delete-compliance-report-btn',
      handler: (formData) => {
        setModalData({
          primaryButtonAction: () => deleteComplianceReport(formData),
          primaryButtonText: t('report:actionBtns.deleteAnalystAdjustmentBtn'),
          primaryButtonColor: 'error',
          secondaryButtonText: t('cancelBtn'),
          title: t('confirmation'),
          content: t('report:deleteConfirmText')
        })
      }
    },
    deleteReassessedReport: {
      ...redOutlinedButton(t('report:actionBtns.deleteReassessBtn'), faTrash),
      id: 'delete-compliance-report-btn',
      handler: (formData) => {
        setModalData({
          primaryButtonAction: () => deleteComplianceReport(formData),
          primaryButtonText: t('report:actionBtns.deleteReassessBtn'),
          primaryButtonColor: 'error',
          secondaryButtonText: t('cancelBtn'),
          title: t('confirmation'),
          content: t('report:deleteConfirmText')
        })
      }
    }
  }

  // Calculate Return to Supplier deadline
  const compliancePeriodYear = parseInt(compliancePeriod)
  const returnDeadline = DateTime.fromObject({
    year: compliancePeriodYear + 1,
    month: 3,
    day: 31
  })
  const isPastReturnDeadline = DateTime.now() > returnDeadline

  return {
    [COMPLIANCE_REPORT_STATUSES.DRAFT]: !isGovernmentUser
      ? [
          reportButtons.submitReport,
          ...(supplementalInitiator
            ? [reportButtons.deleteSupplementalReport]
            : [])
        ]
      : (() => {
          // For government users (analysts), check if it's a Government Adjustment/Reassessment
          if (isGovernmentUser && hasRoles(roles.analyst)) {
            if (supplementalInitiator === 'Government Reassessment') {
              // Government Adjustments/Reassessments in draft mode should show delete button
              return [reportButtons.deleteAnalystAdjustment]
            }
          }
          return []
        })(),
    [COMPLIANCE_REPORT_STATUSES.SUBMITTED]: (() => {
      if (isGovernmentUser && hasRoles(roles.analyst)) {
        const buttons = [
          {
            ...reportButtons.recommendByAnalyst,
            disabled: hasDraftSupplemental
          }
        ]
        if (reportVersion === 0) {
          if (!isPastReturnDeadline) {
            buttons.push({
              ...reportButtons.returnToSupplier,
              disabled: hasDraftSupplemental
            })
          } else {
            buttons.push({
              ...reportButtons.createIdirSupplementalReport,
              disabled: hasDraftSupplemental
            })
          }
        } else {
          // This is reportVersion !== 0 (e.g. supplemental report)
          buttons.push({
            ...reportButtons.returnToSupplier,
            disabled: hasDraftSupplemental
          })
        }
        return buttons
      }
      return [] // Return empty array if not Analyst or not government user
    })(),
    [COMPLIANCE_REPORT_STATUSES.ANALYST_ADJUSTMENT]: [
      ...(isGovernmentUser && hasRoles(roles.analyst)
        ? [
            reportButtons.recommendByAnalyst,
            reportButtons.deleteAnalystAdjustment
          ]
        : [])
    ],
    [COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST]: [
      ...(isGovernmentUser && hasRoles(roles.compliance_manager)
        ? [
            {
              ...reportButtons.recommendByManager,
              disabled: hasDraftSupplemental
            },
            { ...reportButtons.returnToAnalyst, disabled: hasDraftSupplemental }
          ]
        : []),
      ...(isGovernmentUser && hasRoles(roles.director)
        ? [
            { ...reportButtons.assessReport, disabled: hasDraftSupplemental },
            { ...reportButtons.returnToAnalyst, disabled: hasDraftSupplemental }
          ]
        : [])
    ],
    [COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER]: [
      ...(isGovernmentUser && hasRoles(roles.director)
        ? [
            { ...reportButtons.assessReport, disabled: hasDraftSupplemental },
            { ...reportButtons.returnToManager, disabled: hasDraftSupplemental }
          ]
        : [])
    ]
  }
}
