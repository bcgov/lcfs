import { useCurrentUser } from '@/hooks/useCurrentUser'

export const Role = ({ children, roles }) => {
  const { data: currentUser } = useCurrentUser()
  const userRoles = currentUser?.roles?.map((role) => role.name) || []

  const isAuthorized =
    roles?.length > 0 ? roles.some((role) => userRoles.includes(role)) : true

  if (!currentUser) {
    return <div data-test="loading">Loading...</div>
  }

  if (!isAuthorized) {
    return null
  }

  return children
}
