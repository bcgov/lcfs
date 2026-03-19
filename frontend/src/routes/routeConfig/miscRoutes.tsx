import ROUTES from '../routes'
import { Dashboard } from '@/views/Dashboard'
import FormView from '@/views/Forms/FormView'
import { AiAnalyticsPage } from '@/views/AiAnalytics/AiAnalyticsPage'
import { AppRouteObject } from '../types'

export const miscRoutes: AppRouteObject[] = [
  {
    path: ROUTES.DASHBOARD,
    children: [
      {
        path: '',
        element: <Dashboard />,
        handle: { title: 'Dashboard' }
      }
    ]
  },
  {
    path: ROUTES.AI_ANALYTICS,
    element: <AiAnalyticsPage />,
    handle: { title: 'AI Analytics' }
  },
  {
    name: 'Authenticated Form View',
    key: 'authenticated-form-view',
    path: ROUTES.FORMS.VIEW_AUTHENTICATED,
    element: <FormView />,
    handle: { title: 'Form' }
  }
]
