import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useQuery } from '@tanstack/react-query'
import { useCurrentUser } from './useCurrentUser'

export const useRoleList = (params, options) => {
  const client = useApiService()
  const path = apiRoutes.roles + (params ? `?${params}` : '')
  return useQuery({
    queryKey: ['roles'],
    queryFn: async () => (await client.get(path)).data,
    ...options
  })
}

export const useHasRoles = (allowedRoles) => {
  const { data: currentUser } = useCurrentUser()

  const userRoles = currentUser?.roles?.map((role) => role.name) || []

  return allowedRoles?.length > 0
    ? allowedRoles.every((role) => userRoles.includes(role))
    : true
}
