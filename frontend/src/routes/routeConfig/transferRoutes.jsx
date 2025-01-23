import React, { lazy, Suspense } from 'react'
import { Navigate } from 'react-router-dom'
import ROUTES from '../routes'

// Lazy-loaded component
const AddEditViewTransfer = lazy(
  () => import('@/views/Transfers/AddEditViewTransfer')
)

// Utility function to wrap components with Suspense
const withSuspense = (Component, props = {}) => (
  <Suspense fallback={<div>Loading...</div>}>
    <Component {...props} />
  </Suspense>
)

export const transferRoutes = [
  {
    path: ROUTES.TRANSFERS,
    element: <Navigate to={ROUTES.TRANSACTIONS} replace />,
    handle: { title: 'Transfers' }
  },
  {
    path: ROUTES.TRANSFERS.ADD,
    element: withSuspense(AddEditViewTransfer, { mode: 'add' }),
    handle: {
      title: 'New transfer',
      mode: 'add',
      crumb: () => 'New transfer'
    }
  },
  {
    path: ROUTES.TRANSFERS.EDIT,
    element: withSuspense(AddEditViewTransfer, { mode: 'edit' }),
    handle: {
      title: 'Edit transfer',
      mode: 'edit',
      crumb: () => 'Edit transfer'
    }
  },
  {
    path: ROUTES.TRANSFERS.VIEW,
    element: withSuspense(AddEditViewTransfer, { mode: 'view' }),
    handle: {
      title: 'View transfer',
      mode: 'view',
      crumb: () => 'View transfer'
    }
  }
]
