import { useQuery } from '@tanstack/react-query'
import { useApiService } from '@/services/useApiService'

export const useUsers = (options) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => (await client.post('/users/')).data,
    ...options
  })
}

export const useUser = (id, options) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['user', id],
    queryFn: async () => (await client.get(`/users/${id}`)).data,
    ...options
  })
}

