import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useQuery } from '@tanstack/react-query'

export const useRoleList = (params, options) => {
  const client = useApiService()
  const path = apiRoutes.roles + (params ? `?${params}` : '')
  return useQuery({
    queryKey: ['roles'],
    queryFn: async () => (await client.get(path)).data,
    ...options
  })
}
