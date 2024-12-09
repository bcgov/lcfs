import * as ROUTES from '@/constants/routes/routes.js'
import withFeatureFlag from '@/utils/withFeatureFlag.jsx'
import { FEATURE_FLAGS } from '@/constants/config.js'

export const NotificationsBase = () => {
  return <div>Notifications</div>
}

export const Notifications = withFeatureFlag(
  NotificationsBase,
  FEATURE_FLAGS.NOTIFICATIONS,
  ROUTES.DASHBOARD
)
Notifications.displayName = 'Notifications'
