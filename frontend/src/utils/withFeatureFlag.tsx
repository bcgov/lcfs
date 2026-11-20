import type { ComponentType } from 'react'
import { Navigate } from 'react-router-dom'
import { isFeatureEnabled, type FeatureFlagValue } from '@/constants/config'

export const withFeatureFlag = <P extends object>(
  WrappedComponent: ComponentType<P>,
  featureFlag: FeatureFlagValue | undefined,
  redirect?: string
) => {
  const WithFeatureFlag = (props: P) => {
    const isEnabled = isFeatureEnabled(featureFlag as FeatureFlagValue)

    if (!isEnabled && redirect) {
      return <Navigate to={redirect} />
    }
    if (!isEnabled && !redirect) {
      return null
    }

    return <WrappedComponent {...props} />
  }

  // Display name for the wrapped component
  WithFeatureFlag.displayName = `WithFeatureFlag(${
    WrappedComponent.displayName || WrappedComponent.name || 'Component'
  })`

  return WithFeatureFlag
}

export default withFeatureFlag
