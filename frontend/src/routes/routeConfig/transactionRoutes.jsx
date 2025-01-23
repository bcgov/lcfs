import React, { lazy, Suspense } from 'react'
import ROUTES from '../routes'

// Lazy-loaded components
const Transactions = lazy(() => import('@/views/Transactions/Transactions'))
const AddEditViewTransaction = lazy(
  () => import('@/views/Transactions/AddEditViewTransaction')
)

// Utility function to wrap components with Suspense
const withSuspense = (Component, props = {}) => (
  <Suspense fallback={<div>Loading...</div>}>
    <Component {...props} />
  </Suspense>
)

export const transactionRoutes = [
  {
    path: ROUTES.TRANSACTIONS,
    element: withSuspense(Transactions),
    handle: { title: 'Transactions', crumb: () => 'Transactions' }
  },
  {
    path: ROUTES.TRANSACTIONS.ADD,
    element: withSuspense(AddEditViewTransaction, { mode: 'add' }),
    handle: {
      title: 'New transaction',
      mode: 'add'
    }
  },
  {
    path: ROUTES.TRANSACTIONS.EDIT,
    element: withSuspense(AddEditViewTransaction, { mode: 'edit' }),
    handle: {
      title: 'Edit transaction',
      mode: 'edit'
    }
  },
  {
    path: ROUTES.TRANSACTIONS.VIEW,
    element: withSuspense(AddEditViewTransaction, { mode: 'view' }),
    handle: {
      title: 'View transaction',
      mode: 'view'
    }
  }
]
