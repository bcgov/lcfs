import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
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

export const useGetUserActivities = (
  { page = 1, size = 10, sortOrders = [], filters = [] } = {},
  options
) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['/users/activities/all', page, size, sortOrders, filters],
    queryFn: async () =>
      (
        await client.post(apiRoutes.getAllUserActivities, {
          page,
          size,
          sortOrders,
          filters
        })
      ).data,
    ...options
  })
}

export function useDeleteUser(options = {}) {
  const apiClient = useApiService()
  const queryClient = useQueryClient()

  return useMutation({
    ...options,
    mutationFn: async (userID) => {
      const path = apiRoutes.deleteUser.replace(':userID', userID)
      return await apiClient.delete(path)
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['user', options.userID])
      queryClient.invalidateQueries(['users'])
    }
  })
}
