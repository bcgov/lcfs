// complianceReportButtonConfigs.js

import { faPencil, faTrash } from '@fortawesome/free-solid-svg-icons'
import {
  COMPLIANCE_REPORT_STATUSES,
  SUPPLEMENTAL_INITIATOR_TYPE
} from '@/constants/statuses'
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
  deleteSupplementalReport = () => {},
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
    reAssessReport: {
      ...containedButton(t('report:actionBtns.reAssessReportBtn')),
      id: 're-assess-report-btn',
      handler: (formData) => {
        setModalData({
          primaryButtonAction: () =>
            updateComplianceReport({
              ...formData,
              status: COMPLIANCE_REPORT_STATUSES.REASSESSED
            }),
          primaryButtonText: t('report:actionBtns.reAssessReportBtn'),
          secondaryButtonText: t('cancelBtn'),
          title: t('confirmation'),
          content: t('report:reAssessConfirmText')
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
          primaryButtonAction: () => deleteSupplementalReport(formData),
          primaryButtonText: t('report:actionBtns.deleteSupplementalReportBtn'),
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
    // Deadline: March 31 of the next year, 11:59:59 PM in PDT (America/Vancouver)
    const deadlineDate = DateTime.fromObject(
      {
        year: compliancePeriodYear + 1,
        month: 3,
        day: 31,
        hour: 23,
        minute: 59,
        second: 59
      },
      { zone: 'America/Vancouver' }
    )

    // Current time in PDT
    const currentDate = DateTime.now().setZone('America/Vancouver')
    return currentDate <= deadlineDate
  }

  const buttons = {
    [COMPLIANCE_REPORT_STATUSES.DRAFT]: [
      reportButtons.submitReport,
      ...(supplementalInitiator ===
      SUPPLEMENTAL_INITIATOR_TYPE.SUPPLIER_SUPPLEMENTAL
        ? [reportButtons.deleteSupplementalReport]
        : [])
    ],
    [COMPLIANCE_REPORT_STATUSES.SUBMITTED]: [
      ...(isGovernmentUser && hasRoles('Analyst')
        ? [
            reportButtons.recommendByAnalyst,
            ...(canReturnToSupplier() ? [reportButtons.returnToSupplier] : [])
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
    ],
    [COMPLIANCE_REPORT_STATUSES.ASSESSED]: [
      ...(isGovernmentUser && hasRoles('Analyst')
        ? [reportButtons.reAssessReport]
        : [])
    ]
  }

  return buttons
}
