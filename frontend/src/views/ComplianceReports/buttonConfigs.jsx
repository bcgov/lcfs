// complianceReportButtonConfigs.js

import {
  faFloppyDisk,
  faPencil,
  faTrash
} from '@fortawesome/free-solid-svg-icons'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { roles } from '@/constants/roles'
import colors from '@/themes/base/colors'

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
  currentUser,
  t,
  setModalData,
  updateComplianceReport,
  reportData,
  isGovernmentUser,
  isSigningAuthorityDeclared
}) => {
  const reportButtons = {
    deleteDraft: {
      ...redOutlinedButton(t('report:actionBtns.deleteDraftBtn'), faTrash),
      id: 'delete-draft-btn',
      handler: (formData) => {
        setModalData({
          primaryButtonAction: () =>
            updateComplianceReport({
              ...formData,
              status: COMPLIANCE_REPORT_STATUSES.DELETED
            }),
          primaryButtonText: t('report:actionBtns.deleteDraftBtn'),
          primaryButtonColor: 'error',
          secondaryButtonText: t('cancelBtn'),
          title: t('confirmation'),
          content: t('report:deleteConfirmText')
        })
      }
    },
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
      ...containedButton(
        t('report:actionBtns.recommendReportAnalystBtn'),
        faPencil
      ),
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
      ...containedButton(
        t('report:actionBtns.recommendReportManagerBtn'),
        faPencil
      ),
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
          content: t('report:recommendManagerConfirmText')
        })
      }
    },
    assessReport: {
      ...containedButton(t('report:actionBtns.assessReportBtn'), faPencil),
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
      ...containedButton(t('report:actionBtns.reAssessReportBtn'), faPencil),
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
    }
  }

  const buttons = {
    [COMPLIANCE_REPORT_STATUSES.DRAFT]: [
      reportButtons.deleteDraft,
      reportButtons.submitReport
    ],
    [COMPLIANCE_REPORT_STATUSES.SUBMITTED]: [
      ...(isGovernmentUser && hasRoles('Analyst')
        ? [reportButtons.recommendByAnalyst]
        : [])
    ],
    [COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST]: [
      ...(isGovernmentUser && hasRoles('Compliance Manager')
        ? [reportButtons.recommendByManager]
        : [])
    ],
    [COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER]: [
      ...(isGovernmentUser && hasRoles('Director')
        ? [reportButtons.assessReport]
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
