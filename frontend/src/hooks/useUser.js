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

export const saveUpdateUser = (id, data, options) => {
  const client = useApiService()
  if (id) {
    return useQuery({
      queryKey: ['edit-user'],
      queryFn: async () => (await client.put(`/users/${id}`, data)).data,
      ...options
    })
  }
  return useQuery({
    queryKey: ['new-user'],
    queryFn: async () => (await client.post(`/users`, data)).data,
    ...options
  })
}
