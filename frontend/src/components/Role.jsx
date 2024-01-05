import { useCurrentUser } from '@/hooks/useCurrentUser'

export const Role = ({ children, roles }) => {
  const { data: currentUser } = useCurrentUser()
  const userRoles = currentUser?.roles?.map((role) => role.name) || []

  const isAuthorized = roles.some((role) => userRoles.includes(role))

  if (!currentUser) {
    return <div>Loading...</div>
  }

  if (!isAuthorized) {
    return null
  }

  return children
}
