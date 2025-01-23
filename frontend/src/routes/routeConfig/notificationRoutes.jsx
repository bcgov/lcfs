import React, { lazy, Suspense } from 'react'
import ROUTES from '../routes'

// Lazy-loaded components
const NotificationMenu = lazy(
  () => import('@/views/Notifications/NotificationMenu')
)

// Utility function to wrap components with Suspense
const withSuspense = (Component, props = {}) => (
  <Suspense fallback={<div>Loading...</div>}>
    <Component {...props} />
  </Suspense>
)

export const notificationRoutes = [
  {
    path: ROUTES.NOTIFICATIONS,
    element: withSuspense(NotificationMenu, { tabIndex: 0 }),
    handle: { title: 'Notifications' }
  },
  {
    path: ROUTES.NOTIFICATIONS.SETTINGS,
    element: withSuspense(NotificationMenu, { tabIndex: 1 }),
    handle: { title: 'Configure notifications' }
  }
]
