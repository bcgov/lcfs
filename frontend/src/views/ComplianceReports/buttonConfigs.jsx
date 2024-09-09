// complianceReportButtonConfigs.js

import {
  faFloppyDisk,
  faPencil,
  faTrash
} from '@fortawesome/free-solid-svg-icons'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'

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
  methods,
  t,
  setModalData,
  updateComplianceReport,
  reportData,
  isGovernmentUser
}) => {
  const reportButtons = {
    saveDraft: {
      ...outlinedButton(t('report:actionBtns.saveDraftBtn'), faFloppyDisk),
      id: 'save-draft-btn',
      handler: (formData) => {
        updateComplianceReport({
          ...formData,
          status: COMPLIANCE_REPORT_STATUSES.DRAFT
        })
      }
    },
    submitReport: {
      ...containedButton(t('report:actionBtns.submitReportBtn'), faPencil),
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
    recommendReport: {
      ...containedButton(t('report:actionBtns.recommendReportBtn'), faPencil),
      id: 'recommend-report-btn',
      handler: (formData) => {
        setModalData({
          primaryButtonAction: () =>
            updateComplianceReport({
              ...formData,
              status: COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST
            }),
          primaryButtonText: t('report:actionBtns.recommendReportBtn'),
          secondaryButtonText: t('cancelBtn'),
          title: t('confirmation'),
          content: t('report:recommendConfirmText')
        })
      }
    }
  }

  const buttons = {
    [COMPLIANCE_REPORT_STATUSES.DRAFT]: [
      reportButtons.saveDraft,
      reportButtons.submitReport
    ],
    [COMPLIANCE_REPORT_STATUSES.SUBMITTED]: [
      ...(isGovernmentUser && hasRoles('analyst')
        ? [reportButtons.recommendReport]
        : [])
    ]
  }

  return buttons
}
