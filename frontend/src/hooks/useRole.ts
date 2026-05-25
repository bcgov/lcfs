import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useQuery } from '@tanstack/react-query'
import type { QueryOptions } from './types'

export const useRoleList = (params: Record<string, any>, options: QueryOptions<unknown>) => {
  const client = useApiService()
  const path = apiRoutes.roles + (params ? `?${params}` : '')
  return useQuery({
    queryKey: ['roles', params || 'all'],
    queryFn: async () => (await client.get(path)).data,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    ...options
  })
}
