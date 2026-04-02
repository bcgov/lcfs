import ROUTES from '../routes'
import { CalculatorMenu } from '@/views/ComplianceReports/CalculatorMenu'
import FormView from '@/views/Forms/FormView'
import PublicDashboard from '@/views/PublicDashboard/PublicDashboard'
import { FuelCodeBulletinsBase } from '@/views/FuelCodeBulletins/FuelCodeBulletins'
import { AppRouteObject } from '../types'

export const publicPageRoutes: AppRouteObject[] = [
  {
    name: 'Public dashboard',
    key: 'public-dashboard',
    path: ROUTES.PUBLIC_DASHBOARD,
    element: <PublicDashboard />,
    handle: { title: 'LCFS program information', hideBreadcrumb: true }
  },
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
    name: 'Approved carbon intensities',
    key: 'approved-carbon-intensities',
    path: ROUTES.APPROVED_CARBON_INTENSITIES,
    element: <FuelCodeBulletinsBase />,
    handle: { title: 'Approved carbon intensities' }
  },
  {
    name: 'Form View',
    key: 'form-view',
    path: ROUTES.FORMS.VIEW,
    element: <FormView />,
    handle: { title: 'Form' }
  }
]
