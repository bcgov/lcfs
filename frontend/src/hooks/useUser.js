import { useQuery } from '@tanstack/react-query'
import { useApiService } from '@/services/useApiService'
import { apiRoutes } from '@/constants/routes'

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

export const useGetUserLoginHistory = (
  { page = 1, size = 10, sortOrders = [], filters = [] } = {},
  options
) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['user-login-history', page, size, sortOrders, filters],
    queryFn: async () =>
      (
        await client.post(apiRoutes.getUserLoginHistories, {
          page,
          size,
          sortOrders,
          filters
        })
      ).data,
    ...options
  })
}
