import { PublicMarketDataGate } from './PublicMarketDataGate'
import ROUTES from '../routes'
import { AppRouteObject } from '../types'

export const marketDataRoutes: AppRouteObject[] = [
  {
    name: 'Credit market data',
    key: 'public-market-data',
    path: ROUTES.PUBLIC_MARKET_DATA,
    element: <PublicMarketDataGate />,
    handle: { title: 'Credit market data', maxWidth: 'xl' }
  }
]
