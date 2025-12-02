import { Navigate } from 'react-router-dom'
import { isFeatureEnabled } from '@/constants/config'

export const withFeatureFlag = (WrappedComponent, featureFlag, redirect) => {
  const WithFeatureFlag = (props) => {
    const isEnabled = isFeatureEnabled(featureFlag)

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
