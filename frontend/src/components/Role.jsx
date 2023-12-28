import { useUserStore } from '@/stores/useUserStore'

export const Role = ({ children, roles }) => {
  const user = useUserStore((state) => state.user)
  const userRoles = user?.user_roles?.map((role) => role.name) || []

  const isAuthorized = roles.some((role) => userRoles.includes(role))

  if (!user) {
    return <div>Loading...</div>
  }

  if (!isAuthorized) {
    return null
  }

  return children
}
