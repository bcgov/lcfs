import ROUTES from '../routes'
import { NotificationMenu } from '@/views/Notifications/NotificationMenu'

export const notificationRoutes = [
  {
    path: ROUTES.NOTIFICATIONS.LIST,
    element: <NotificationMenu tabIndex={0} />,
    handle: { title: 'Notifications' }
  },
  {
    path: ROUTES.NOTIFICATIONS.SETTINGS,
    element: <NotificationMenu tabIndex={1} />,
    handle: { title: 'Configure notifications' }
  }
]
