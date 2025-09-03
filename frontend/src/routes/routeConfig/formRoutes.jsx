import ROUTES from '../routes'
import FormView from '@/views/Forms/FormView'

export const formRoutes = [
  {
    name: 'Form View',
    key: 'form-view',
    path: ROUTES.FORMS.VIEW,
    element: <FormView />,
    handle: { title: 'Form' }
  }
]
