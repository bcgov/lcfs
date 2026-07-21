import ROUTES from '../routes'
import { CalculatorMenu } from '@/views/ComplianceReports/CalculatorMenu'
import FormView from '@/views/Forms/FormView'
import PublicDashboardRoute from '@/views/PublicDashboard/PublicDashboardRoute'
import { PublicMarketData } from '@/views/PublicMarketData'
import { FuelCodeBulletinsBase } from '@/views/FuelCodeBulletins/FuelCodeBulletins'
import { FEATURE_FLAGS, isFeatureEnabled } from '@/constants/config'
import { AppRouteObject } from '../types'

const creditMarketPageEnabled = isFeatureEnabled(FEATURE_FLAGS.CREDIT_MARKET_LOGIN_PAGE)

export const publicPageRoutes: AppRouteObject[] = [
  {
    name: 'Public dashboard',
    key: 'public-dashboard',
    path: ROUTES.PUBLIC_DASHBOARD,
    element: <PublicDashboardRoute />,
    handle: {
      title: 'LCFS program information',
      hideBreadcrumb: creditMarketPageEnabled
    }
  },
  {
    name: 'Credit market data',
    key: 'public-market-data',
    path: ROUTES.PUBLIC_MARKET_DATA,
    element: <PublicMarketData />,
    handle: { title: 'Credit market data' }
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
