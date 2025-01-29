import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export const useNotificationsCount = (options) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['notifications-count'],
    queryFn: async () => {
      const response = await client.get(apiRoutes.getNotificationsCount)
      return response.data
    },
    staleTime: 1 * 60 * 1000, // 1 minute
    cacheTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 1 * 60 * 1000, // 1 minute
    ...options
  })
}

export const useGetNotificationMessages = (
  { page = 1, size = 10, sortOrders = [], filters = [] } = {},
  options
) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['notification-messages', page, size, sortOrders, filters],
    queryFn: async () => {
      const response = await client.post(apiRoutes.getNotifications, {
        page,
        size,
        sortOrders,
        filters
      })
      return response.data
    },
    ...options
  })
}

export const useMarkNotificationAsRead = (options) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (_ids) =>
      client.put(apiRoutes.notifications, _ids),
    onSettled: () => {
      queryClient.invalidateQueries(['notifications-count'])
      queryClient.invalidateQueries(['notifications-messages'])
    },
    ...options
  })
}

export const useDeleteNotificationMessages = (options) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (_ids) =>
      client.delete(apiRoutes.notifications, { data: _ids }),
    onSettled: () => {
      queryClient.invalidateQueries(['notifications-count'])
      queryClient.invalidateQueries(['notifications-messages'])
    },
    ...options
  })
}

export const useNotificationSubscriptions = (options) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['notification-subscriptions'],
    queryFn: async () => {
      try {
        const response = await client.get(
          apiRoutes.getNotificationSubscriptions
        )
        return response.data
      } catch (error) {
        if (error.response && error.response.status === 404) {
          // Return an empty array if 404 is returned
          return []
        }
        throw error
      }
    },
    ...options
  })
}

export const useCreateSubscription = (options) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) =>
      client.post(apiRoutes.saveNotificationSubscriptions, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['notification-subscriptions'])
    },
    ...options
  })
}

export const useDeleteSubscription = (options) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (subscriptionId) =>
      client.post(apiRoutes.saveNotificationSubscriptions, {
        notificationChannelSubscriptionId: subscriptionId,
        deleted: true
      }),
    onSuccess: () => {
      queryClient.invalidateQueries(['notification-subscriptions'])
    },
    ...options
  })
}

export const useUpdateNotificationsEmail = (options) => {
  const client = useApiService()
  return useMutation({
    mutationFn: (data) => client.post(apiRoutes.updateNotificationsEmail, data),
    ...options
  })
}
