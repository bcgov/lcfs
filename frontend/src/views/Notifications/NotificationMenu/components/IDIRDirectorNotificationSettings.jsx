import NotificationSettingsForm from './NotificationSettingsForm'

const IDIRDirectorNotificationSettings = () => {
  // Categories for IDIR Director
  const categories = {
    'idirDirector.categories.transfers': {
      title: 'idirDirector.categories.transfers.title',
      IDIR_D__TR__ANALYST_RECOMMENDATION:
        'idirDirector.categories.transfers.analystRecommendation'
    },
    'idirDirector.categories.initiativeAgreements': {
      title: 'idirDirector.categories.initiativeAgreements.title',
      IDIR_D__IA__ANALYST_RECOMMENDATION:
        'idirDirector.categories.initiativeAgreements.analystRecommendation'
    },
    'idirDirector.categories.complianceReports': {
      title: 'idirDirector.categories.complianceReports.title',
      IDIR_D__CR__MANAGER_RECOMMENDATION:
        'idirDirector.categories.complianceReports.managerRecommendation'
    }
  }

  return <NotificationSettingsForm categories={categories} />
}

export default IDIRDirectorNotificationSettings
