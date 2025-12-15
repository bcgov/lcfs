import NotificationSettingsForm from './NotificationSettingsForm'

const IDIRComplianceManagerNotificationSettings = () => {
  // Categories for IDIR Compliance Manager
  const categories = {
    'idirComplianceManager.categories.governmentNotifications': {
      title: 'idirComplianceManager.categories.governmentNotifications.title',
      IDIR_COMPLIANCE_MANAGER__GOVERNMENT_NOTIFICATION:
        'idirComplianceManager.categories.governmentNotifications.subscription'
    },
    'idirComplianceManager.categories.complianceReports': {
      title: 'idirComplianceManager.categories.complianceReports.title',
      IDIR_COMPLIANCE_MANAGER__COMPLIANCE_REPORT__SUBMITTED_FOR_REVIEW:
        'idirComplianceManager.categories.complianceReports.submittedForReview',
      IDIR_COMPLIANCE_MANAGER__COMPLIANCE_REPORT__ANALYST_RECOMMENDATION:
        'idirComplianceManager.categories.complianceReports.analystRecommendation',
      IDIR_COMPLIANCE_MANAGER__COMPLIANCE_REPORT__DIRECTOR_ASSESSMENT:
        'idirComplianceManager.categories.complianceReports.directorAssessment'
    }
  }

  return <NotificationSettingsForm categories={categories} />
}

export default IDIRComplianceManagerNotificationSettings
