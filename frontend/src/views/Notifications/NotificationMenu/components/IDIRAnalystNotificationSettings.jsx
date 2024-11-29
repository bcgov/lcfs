import NotificationSettingsForm from './NotificationSettingsForm'

const IDIRAnalystNotificationSettings = () => {
  // Categories for IDIR Analyst
  const categories = {
    'idirAnalyst.categories.transfers': {
      title: 'idirAnalyst.categories.transfers.title',
      IDIR_A__TR__SUBMITTED_FOR_REVIEW:
        'idirAnalyst.categories.transfers.submittedForReview',
      IDIR_A__TR__RESCINDED_ACTION:
        'idirAnalyst.categories.transfers.rescindedAction',
      IDIR_A__TR__DIRECTOR_RECORDED:
        'idirAnalyst.categories.transfers.directorRecorded'
    },
    'idirAnalyst.categories.initiativeAgreements': {
      title: 'idirAnalyst.categories.initiativeAgreements.title',
      IDIR_A__IA__RETURNED_TO_ANALYST:
        'idirAnalyst.categories.initiativeAgreements.returnedToAnalyst'
    },
    'idirAnalyst.categories.complianceReports': {
      title: 'idirAnalyst.categories.complianceReports.title',
      IDIR_A__CR__SUBMITTED_FOR_REVIEW:
        'idirAnalyst.categories.complianceReports.submittedForReview',
      IDIR_A__CR__MANAGER_RECOMMENDATION:
        'idirAnalyst.categories.complianceReports.managerRecommendation',
      IDIR_A__CR__DIRECTOR_DECISION:
        'idirAnalyst.categories.complianceReports.directorDecision'
    }
  }

  return <NotificationSettingsForm categories={categories} />
}

export default IDIRAnalystNotificationSettings
