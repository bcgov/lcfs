import useUserStore from '../store/useUserStore'

export const withRole = (WrappedComponent, allowedRoles) => {
  const WithRole = (props) => {
    const user = useUserStore((state) => state.user)
    const userRoles = user?.user_roles?.map((role) => role.name) || []

    const isAuthorized = allowedRoles.some((role) => userRoles.includes(role))

    if (!user) {
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
