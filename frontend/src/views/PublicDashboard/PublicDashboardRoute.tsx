import { FEATURE_FLAGS, isFeatureEnabled } from '@/constants/config'
import { PublicDashboard } from './PublicDashboard'
import { LegacyPublicDashboard } from './LegacyPublicDashboard'

export const PublicDashboardRoute = () =>
  isFeatureEnabled(FEATURE_FLAGS.CREDIT_MARKET_LOGIN_PAGE) ? (
    <PublicDashboard />
  ) : (
    <LegacyPublicDashboard />
  )

export default PublicDashboardRoute
