import { useCurrentUser } from '@/hooks/useCurrentUser'

export const withRole = (WrappedComponent, allowedRoles) => {
  const WithRole = (props) => {
    const { data: currentUser } = useCurrentUser()
    const userRoles = currentUser?.roles?.map((role) => role.name) || []

    const isAuthorized = allowedRoles.some((role) => userRoles.includes(role))

    if (!currentUser) {
      return <div>Loading...</div>
    }

    return isAuthorized ? <WrappedComponent {...props} /> : <></>
  }

  // Display name for the wrapped component
  WithRole.displayName = `WithRole(${
    WrappedComponent.displayName || WrappedComponent.name || 'Component'
  })`

  return WithRole
}

export default withRole
