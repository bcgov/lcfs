import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { ComponentType } from 'react'
import { Navigate } from 'react-router-dom'

export const withRole = <P extends object>(
  WrappedComponent: ComponentType<P>,
  allowedRoles: string[],
  redirect?: string
) => {
  const WithRole = (props: P) => {
    const { data: currentUser } = useCurrentUser()
    const userRoles =
      currentUser?.roles?.map((role: { name: string }) => role.name) || []

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
