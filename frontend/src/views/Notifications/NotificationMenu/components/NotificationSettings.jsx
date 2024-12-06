import { roles } from '@/constants/roles'
import { Role } from '@/components/Role'

// Import user-type-specific components
import BCeIDNotificationSettings from './BCeIDNotificationSettings'
import IDIRAnalystNotificationSettings from './IDIRAnalystNotificationSettings'
import IDIRComplianceManagerNotificationSettings from './IDIRComplianceManagerNotificationSettings'
import IDIRDirectorNotificationSettings from './IDIRDirectorNotificationSettings'

export const NotificationSettings = () => {
  return (
    <>
      {/* BCeID User */}
      <Role roles={[roles.supplier]}>
        <BCeIDNotificationSettings />
      </Role>

      {/* IDIR Director */}
      <Role roles={[roles.director]}>
        <IDIRDirectorNotificationSettings />
      </Role>

      {/* IDIR Compliance Manager */}
      <Role roles={[roles.compliance_manager]}>
        <IDIRComplianceManagerNotificationSettings />
      </Role>

      {/* IDIR Analyst */}
      <Role roles={[roles.analyst]}>
        <IDIRAnalystNotificationSettings />
      </Role>
    </>
  )
}
