import NotificationSettingsForm from './NotificationSettingsForm'

const IDIRAnalystNotificationSettings = () => {
  // Categories for IDIR Analyst
  const categories = {
    'idirAnalyst.categories.transfers': {
      title: 'idirAnalyst.categories.transfers.title',
      IDIR_ANALYST__TRANSFER__SUBMITTED_FOR_REVIEW:
        'idirAnalyst.categories.transfers.submittedForReview',
      IDIR_ANALYST__TRANSFER__RESCINDED_ACTION:
        'idirAnalyst.categories.transfers.rescindedAction',
      IDIR_ANALYST__TRANSFER__DIRECTOR_RECORDED:
        'idirAnalyst.categories.transfers.directorRecorded',
      IDIR_ANALYST__TRANSFER__RETURNED_TO_ANALYST:
        'idirAnalyst.categories.initiativeAgreements.returnedToAnalyst'
    },
    'idirAnalyst.categories.initiativeAgreements': {
      title: 'idirAnalyst.categories.initiativeAgreements.title',
      IDIR_ANALYST__INITIATIVE_AGREEMENT__RETURNED_TO_ANALYST:
        'idirAnalyst.categories.initiativeAgreements.returnedToAnalyst'
    },
    'idirAnalyst.categories.complianceReports': {
      title: 'idirAnalyst.categories.complianceReports.title',
      IDIR_ANALYST__COMPLIANCE_REPORT__SUBMITTED_FOR_REVIEW:
        'idirAnalyst.categories.complianceReports.submittedForReview',
      IDIR_ANALYST__COMPLIANCE_REPORT__MANAGER_RECOMMENDATION:
        'idirAnalyst.categories.complianceReports.managerRecommendation',
      IDIR_ANALYST__COMPLIANCE_REPORT__DIRECTOR_DECISION:
        'idirAnalyst.categories.complianceReports.directorDecision'
    }
  }

  return <NotificationSettingsForm categories={categories} />
}

export default IDIRAnalystNotificationSettings
