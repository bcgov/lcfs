import ROUTES from '../routes'
import { CreditCalculator } from '@/views/ComplianceReports/CreditCalculator'
import FormView from '@/views/Forms/FormView'

export const publicPageRoutes = [
  {
    name: 'Credit Calculator',
    key: 'credit-calculator',
    path: ROUTES.CREDIT_CALCULATOR,
    element: <CreditCalculator />,
    handle: { title: 'Credit Calculator' }
  },
  {
    name: 'Form View',
    key: 'form-view',
    path: ROUTES.FORMS.VIEW,
    element: <FormView />,
    handle: { title: 'Form' }
  }
]
