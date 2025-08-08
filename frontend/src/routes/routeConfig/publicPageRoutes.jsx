import ROUTES from '../routes'
import { CreditCalculator } from '@/views/ComplianceReports/CreditCalculator'

export const publicPageRoutes = [
  {
    name: 'Credit Calculator',
    key: 'credit-calculator',
    path: ROUTES.CREDIT_CALCULATOR,
    element: <CreditCalculator />,
    handle: { title: 'Credit Calculator' }
  }
]
