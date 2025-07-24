import NotificationSettingsForm from './NotificationSettingsForm'

const IDIRDirectorNotificationSettings = () => {
  // Categories for IDIR Director
  const categories = {
    'idirDirector.categories.transfers': {
      title: 'idirDirector.categories.transfers.title',
      IDIR_DIRECTOR__TRANSFER__ANALYST_RECOMMENDATION:
        'idirDirector.categories.transfers.analystRecommendation'
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
    'idirDirector.categories.fuelCodes': {
      title: 'idirDirector.categories.fuelCodes.title',
      IDIR_DIRECTOR__FUEL_CODE__ANALYST_RECOMMENDATION:
        'idirDirector.categories.fuelCodes.analystRecommendation'
    }
  }

  return <NotificationSettingsForm categories={categories} />
}

export default IDIRDirectorNotificationSettings
