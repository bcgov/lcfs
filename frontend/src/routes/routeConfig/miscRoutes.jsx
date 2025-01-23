import React, { lazy, Suspense } from 'react'
import ROUTES from '../routes'

// Lazy-loaded components
const FileSubmissions = lazy(() => import('@/views/FileSubmissions'))
const Dashboard = lazy(() => import('@/views/Dashboard'))

// Utility function to wrap components with Suspense
const withSuspense = (Component, props = {}) => (
  <Suspense fallback={<div>Loading...</div>}>
    <Component {...props} />
  </Suspense>
)

export const miscRoutes = [
  {
    path: ROUTES.FILE_SUBMISSION,
    element: withSuspense(FileSubmissions),
    handle: { title: 'File Submissions' }
  },
  {
    path: ROUTES.DASHBOARD,
    children: [
      {
        path: '',
        element: withSuspense(Dashboard),
        handle: { title: 'Dashboard' }
      }
    ]
  }
]
