import ROUTES from '../routes'
import { CreditCalculator } from '@/views/ComplianceReports/CreditCalculator'
import FormView from '@/views/Forms/FormView'
import { AppRouteObject } from '../types'

export const publicPageRoutes: AppRouteObject[] = [
  {
    name: 'Compliance unit calculator',
    key: 'credit-calculator',
    path: ROUTES.CREDIT_CALCULATOR,
    element: <CreditCalculator />,
    handle: { title: 'Compliance unit calculator' }
  },
  {
    name: 'Form View',
    key: 'form-view',
    path: ROUTES.FORMS.VIEW,
    element: <FormView />,
    handle: { title: 'Form' }
  }
]
