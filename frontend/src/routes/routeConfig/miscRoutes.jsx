import ROUTES from '../routes'
import { Dashboard } from '@/views/Dashboard'

export const miscRoutes = [
  {
    path: ROUTES.DASHBOARD,
    children: [
      {
        path: '',
        element: <Dashboard />,
        handle: { title: 'Dashboard' }
      }
    ]
  }
]
