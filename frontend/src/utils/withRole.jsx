import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Navigate } from 'react-router-dom'

export const withRole = (WrappedComponent, allowedRoles, redirect) => {
  const WithRole = (props) => {
    const { data: currentUser } = useCurrentUser()
    const userRoles = currentUser?.roles?.map((role) => role.name) || []

    const isAuthorized = allowedRoles.some((role) => userRoles.includes(role))

    if (!currentUser) {
      return <div>Loading...</div>
    }

    if (!isAuthorized && redirect) {
      return <Navigate to={redirect} />
    }
    if (!isAuthorized && !redirect) {
      return null
    }

    return <WrappedComponent {...props} />
  }

  // Display name for the wrapped component
  WithRole.displayName = `WithRole(${
    WrappedComponent.displayName || WrappedComponent.name || 'Component'
  })`

  return WithRole
}

export default withRole
