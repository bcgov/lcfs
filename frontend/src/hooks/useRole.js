import { useApiService } from '@/services/useApiService'
import { useQuery } from '@tanstack/react-query'

export const useRoleList = (options) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['roles'],
    queryFn: async () => (await client.get(`/roles/`)).data,
    ...options
  })
}
