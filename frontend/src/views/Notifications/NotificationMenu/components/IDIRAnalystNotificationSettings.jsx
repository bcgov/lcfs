import NotificationSettingsForm from './NotificationSettingsForm'

const IDIRAnalystNotificationSettings = () => {
  // Categories for IDIR Analyst
  const categories = {
    'idirAnalyst.categories.governmentNotifications': {
      title: 'idirAnalyst.categories.governmentNotifications.title',
      IDIR_ANALYST__GOVERNMENT_NOTIFICATION:
        'idirAnalyst.categories.governmentNotifications.subscription'
    },
    'idirAnalyst.categories.transfers': {
      title: 'idirAnalyst.categories.transfers.title',
      IDIR_ANALYST__TRANSFER__SUBMITTED_FOR_REVIEW:
        'idirAnalyst.categories.transfers.submittedForReview',
      IDIR_ANALYST__TRANSFER__RESCINDED_ACTION:
        'idirAnalyst.categories.transfers.rescindedAction',
      IDIR_ANALYST__TRANSFER__DIRECTOR_RECORDED:
        'idirAnalyst.categories.transfers.directorRecorded',
      IDIR_ANALYST__TRANSFER__RETURNED_TO_ANALYST:
        'idirAnalyst.categories.initiativeAgreements.returnedToAnalyst',
      PUBLIC__CREDIT_MARKET_MONTHLY_REPORT:
        'idirAnalyst.categories.transfers.creditMarketMonthlyReport'
    },
    'idirAnalyst.categories.initiativeAgreements': {
      title: 'idirAnalyst.categories.initiativeAgreements.title',
      IDIR_ANALYST__INITIATIVE_AGREEMENT__RETURNED_TO_ANALYST:
        'idirAnalyst.categories.initiativeAgreements.returnedToAnalyst'
    },
    'idirAnalyst.categories.ciApplications': {
      title: 'idirAnalyst.categories.ciApplications.title',
      IDIR_ANALYST__CI_APPLICATION__DIRECTOR_APPROVAL:
        'idirAnalyst.categories.ciApplications.directorApproval',
      IDIR_ANALYST__CI_APPLICATION__DIRECTOR_RETURNED:
        'idirAnalyst.categories.ciApplications.directorReturned',
      IDIR_ANALYST__CI_APPLICATION__APPLICANT_ACTIVITY:
        'idirAnalyst.categories.ciApplications.applicantActivity'
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
