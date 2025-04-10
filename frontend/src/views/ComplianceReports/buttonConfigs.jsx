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
  deleteComplianceReport = () => {},
  compliancePeriod,
  isGovernmentUser,
  isSigningAuthorityDeclared,
  supplementalInitiator
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

  const canReturnToSupplier = () => {
    const compliancePeriodYear = parseInt(compliancePeriod)
    const deadlineDate = new Date(compliancePeriodYear + 1, 2, 31) // Month is 0-based, so 2 = March
    const currentDate = new Date()
    return currentDate <= deadlineDate
  }

  return {
    [COMPLIANCE_REPORT_STATUSES.DRAFT]: [
      reportButtons.submitReport,
      ...(supplementalInitiator ? [reportButtons.deleteSupplementalReport] : [])
    ],
    [COMPLIANCE_REPORT_STATUSES.SUBMITTED]: [
      ...(isGovernmentUser && hasRoles('Analyst')
        ? [reportButtons.recommendByAnalyst, reportButtons.returnToSupplier]
        : [])
    ],
    [COMPLIANCE_REPORT_STATUSES.ANALYST_ADJUSTMENT]: [
      ...(isGovernmentUser && hasRoles('Analyst')
        ? [
            reportButtons.recommendByAnalyst,
            reportButtons.deleteAnalystAdjustment
          ]
        : [])
    ],
    [COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST]: [
      ...(isGovernmentUser && hasRoles('Compliance Manager')
        ? [reportButtons.recommendByManager, reportButtons.returnToAnalyst]
        : [])
    ],
    [COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER]: [
      ...(isGovernmentUser && hasRoles('Director')
        ? [reportButtons.assessReport, reportButtons.returnToManager]
        : [])
    ]
  }
}
