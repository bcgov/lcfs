import ROUTES from '../routes'
import { NotificationMenu } from '@/views/Notifications/NotificationMenu'
import { AppRouteObject } from '../types'

export const notificationRoutes: AppRouteObject[] = [
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
