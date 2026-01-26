import { Navigate } from 'react-router-dom'
import ROUTES from '../routes'
import { AddEditViewTransfer } from '@/views/Transfers'
import { AppRouteObject } from '../types'

export const transferRoutes: AppRouteObject[] = [
  {
    path: ROUTES.TRANSFERS.LIST,
    element: <Navigate to={ROUTES.TRANSACTIONS.LIST} replace />,
    handle: { title: 'Transfers' }
  },
  {
    path: ROUTES.TRANSFERS.ADD,
    element: <AddEditViewTransfer />,
    handle: {
      title: 'New transfer',
      mode: 'add'
    }
  },
  {
    path: ROUTES.TRANSFERS.EDIT,
    element: <AddEditViewTransfer />,
    handle: {
      title: 'Edit transfer',
      mode: 'edit'
    }
  },
  {
    path: ROUTES.TRANSFERS.VIEW,
    element: <AddEditViewTransfer />,
    handle: {
      title: 'View transfer',
      mode: 'view'
    }
  }
]
