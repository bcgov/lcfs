import ROUTES from '../routes'
import FormView from '@/views/Forms/FormView'
import { AppRouteObject } from '../types'

export const formRoutes: AppRouteObject[] = [
  {
    name: 'Form View',
    key: 'form-view',
    path: ROUTES.FORMS.VIEW,
    element: <FormView />,
    handle: { title: 'Form' }
  }
]
