import { Navigate } from 'react-router-dom'
import { FEATURE_FLAGS, isFeatureEnabled } from '@/constants/config'
import { roles } from '@/constants/roles'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { PublicMarketData } from '@/views/PublicMarketData'
import ROUTES from '../routes'
import { AppRouteObject } from '../types'

const PublicMarketDataGate = () => {
  const publicMarketDataEnabled = isFeatureEnabled(FEATURE_FLAGS.PUBLIC_MARKET_DATA)
  const { data: currentUser, hasRoles } = useCurrentUser()

  if (publicMarketDataEnabled || hasRoles(roles.administrator)) {
    return <PublicMarketData />
  }

  if (!currentUser) {
    return <div>Loading...</div>
  }

  return <Navigate to={ROUTES.DASHBOARD} />
}

export const marketDataRoutes: AppRouteObject[] = [
  {
    name: 'Credit market data',
    key: 'public-market-data',
    path: ROUTES.PUBLIC_MARKET_DATA,
    element: <PublicMarketDataGate />,
    handle: { title: 'Credit market data', maxWidth: 'xl' }
  }
]
