import NotificationSettingsForm from './NotificationSettingsForm'

const IDIRComplianceManagerNotificationSettings = () => {
  // Categories for IDIR Compliance Manager
  const categories = {
    'idirComplianceManager.categories.complianceReports': {
      title: 'idirComplianceManager.categories.complianceReports.title',
      IDIR_CM__CR__SUBMITTED_FOR_REVIEW:
        'idirComplianceManager.categories.complianceReports.submittedForReview',
      IDIR_CM__CR__ANALYST_RECOMMENDATION:
        'idirComplianceManager.categories.complianceReports.analystRecommendation',
      IDIR_CM__CR__DIRECTOR_ASSESSMENT:
        'idirComplianceManager.categories.complianceReports.directorAssessment'
    }
  }

  return <NotificationSettingsForm categories={categories} />
}

export default IDIRComplianceManagerNotificationSettings
