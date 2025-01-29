import {
  Transactions,
  AddEditViewTransaction,
  ViewOrgTransaction
} from '@/views/Transactions'
import ROUTES from '../routes'

export const transactionRoutes = [
  {
    path: ROUTES.TRANSACTIONS.LIST,
    element: <Transactions />,
    handle: { title: 'Transactions', crumb: () => 'Transactions' }
  },
  {
    path: ROUTES.TRANSACTIONS.ADD,
    element: <AddEditViewTransaction />,
    handle: {
      title: 'New transaction',
      mode: 'add'
    }
  },
  {
    path: ROUTES.TRANSACTIONS.EDIT,
    element: <AddEditViewTransaction />,
    handle: {
      title: 'Edit transaction',
      mode: 'edit'
    }
  },
  {
    path: ROUTES.TRANSACTIONS.VIEW,
    element: <AddEditViewTransaction />,
    handle: {
      title: 'View transaction',
      mode: 'view'
    }
  },
  {
    path: ROUTES.TRANSACTIONS.ADMIN_ADJUSTMENT.VIEW,
    element: <AddEditViewTransaction />,
    handle: {
      title: 'Admin adjustment',
      mode: 'view'
    }
  },
  {
    path: ROUTES.TRANSACTIONS.ADMIN_ADJUSTMENT.ORG_VIEW,
    element: <ViewOrgTransaction />,
    handle: {
      title: 'Admin adjustment'
    }
  },
  {
    path: ROUTES.TRANSACTIONS.ADMIN_ADJUSTMENT.EDIT,
    element: <AddEditViewTransaction />,
    handle: {
      title: 'Edit admin adjustment',
      mode: 'edit'
    }
  },
  {
    path: ROUTES.TRANSACTIONS.INITIATIVE_AGREEMENT.VIEW,
    element: <AddEditViewTransaction />,
    handle: {
      title: 'Initiative agreement',
      mode: 'view'
    }
  },
  {
    path: ROUTES.TRANSACTIONS.INITIATIVE_AGREEMENT.ORG_VIEW,
    element: <ViewOrgTransaction />,
    handle: {
      title: 'Initiative agreement'
    }
  },
  {
    path: ROUTES.TRANSACTIONS.INITIATIVE_AGREEMENT.EDIT,
    element: <AddEditViewTransaction />,
    handle: {
      title: 'Edit initiative agreement',
      mode: 'edit'
    }
  }
]
