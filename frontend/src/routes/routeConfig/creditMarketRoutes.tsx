import { CreditMarket } from '@/views/CreditMarket'
import ROUTES from '../routes'
import { AppRouteObject } from '../types'

export const creditMarketRoutes: AppRouteObject[] = [
  {
    path: ROUTES.CREDIT_MARKET,
    element: <CreditMarket />,
    handle: {
      title: 'Credit market',
      crumb: () => 'Credit market'
    }
  }
]
