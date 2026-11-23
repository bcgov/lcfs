import type { ReactNode } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'

export const Role = ({
  children,
  roles
}: {
  children?: ReactNode
  roles?: string[]
}) => {
  const { data: currentUser } = useCurrentUser()
  const userRoles =
    currentUser?.roles?.map((role: { name: string }) => role.name) || []

  const isAuthorized =
    roles && roles.length > 0
      ? roles.some((role) => userRoles.includes(role))
      : true

  if (!currentUser) {
    return <div data-test="loading">Loading...</div>
  }

  if (!isAuthorized) {
    return null
  }

  return children
}
