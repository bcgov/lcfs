import { useCurrentUser } from '@/hooks/useCurrentUser'
import NotificationSettingsForm from './NotificationSettingsForm'

const BCeIDNotificationSettings = () => {
  const { data: currentUser } = useCurrentUser()

  // Categories for BCeID users
  const categories = {
    'bceid.categories.transfers': {
      title: 'bceid.categories.transfers.title',
      BCEID__TR__PARTNER_ACTIONS: 'bceid.categories.transfers.partnerActions',
      BCEID__TR__DIRECTOR_DECISION:
        'bceid.categories.transfers.directorDecision'
    },
    'bceid.categories.initiativeAgreements': {
      title: 'bceid.categories.initiativeAgreements.title',
      BCEID__IA__DIRECTOR_APPROVAL:
        'bceid.categories.initiativeAgreements.directorApproval'
    },
    'bceid.categories.complianceReports': {
      title: 'bceid.categories.complianceReports.title',
      BCEID__CR__DIRECTOR_ASSESSMENT:
        'bceid.categories.complianceReports.directorAssessment'
    }
  }

  return (
    <NotificationSettingsForm
      categories={categories}
      showEmailField
      initialEmail={currentUser.notificationsEmail}
    />
  )
}

export default BCeIDNotificationSettings
