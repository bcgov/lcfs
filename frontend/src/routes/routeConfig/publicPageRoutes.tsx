import ROUTES from '../routes'
import { CalculatorMenu } from '@/views/ComplianceReports/CalculatorMenu'
import FormView from '@/views/Forms/FormView'
import { AppRouteObject } from '../types'

export const publicPageRoutes: AppRouteObject[] = [
  {
    name: 'Compliance unit calculator',
    key: 'credit-calculator',
    path: ROUTES.CREDIT_CALCULATOR,
    element: <CalculatorMenu tabIndex={0} />,
    handle: { title: 'Compliance unit calculator' }
  },
  {
    name: 'Calculation data',
    key: 'calculation-data',
    path: ROUTES.CALCULATION_DATA,
    element: <CalculatorMenu tabIndex={1} />,
    handle: { title: 'Calculation data' }
  },
  {
    name: 'Form View',
    key: 'form-view',
    path: ROUTES.FORMS.VIEW,
    element: <FormView />,
    handle: { title: 'Form' }
  }
]
