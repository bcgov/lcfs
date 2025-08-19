import ROUTES from '../routes'
import { Dashboard } from '@/views/Dashboard'
import FormView from '@/views/Forms/FormView'

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
  },
  {
    name: 'Authenticated Form View',
    key: 'authenticated-form-view',
    path: ROUTES.FORMS.VIEW_AUTHENTICATED,
    element: <FormView />,
    handle: { title: 'Form' }
  }
]
