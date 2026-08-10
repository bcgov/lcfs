import NotificationSettingsForm from './NotificationSettingsForm'

const IDIRDirectorNotificationSettings = () => {
  // Categories for IDIR Director
  const categories = {
    'idirDirector.categories.governmentNotifications': {
      title: 'idirDirector.categories.governmentNotifications.title',
      IDIR_DIRECTOR__GOVERNMENT_NOTIFICATION:
        'idirDirector.categories.governmentNotifications.subscription'
    },
    'idirDirector.categories.transfers': {
      title: 'idirDirector.categories.transfers.title',
      IDIR_DIRECTOR__TRANSFER__ANALYST_RECOMMENDATION:
        'idirDirector.categories.transfers.analystRecommendation',
      PUBLIC__CREDIT_MARKET_MONTHLY_REPORT:
        'idirDirector.categories.transfers.creditMarketMonthlyReport'
    },
    'idirDirector.categories.initiativeAgreements': {
      title: 'idirDirector.categories.initiativeAgreements.title',
      IDIR_DIRECTOR__INITIATIVE_AGREEMENT__ANALYST_RECOMMENDATION:
        'idirDirector.categories.initiativeAgreements.analystRecommendation'
    },
    'idirDirector.categories.complianceReports': {
      title: 'idirDirector.categories.complianceReports.title',
      IDIR_DIRECTOR__COMPLIANCE_REPORT__MANAGER_RECOMMENDATION:
        'idirDirector.categories.complianceReports.managerRecommendation'
    },
    'idirDirector.categories.ciApplications': {
      title: 'idirDirector.categories.ciApplications.title',
      IDIR_DIRECTOR__CI_APPLICATION__ANALYST_RECOMMENDATION:
        'idirDirector.categories.ciApplications.analystRecommendation'
    }
  }

  return <NotificationSettingsForm categories={categories} />
}

export default IDIRDirectorNotificationSettings
