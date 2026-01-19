import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useApiService } from '@/services/useApiService'
import { apiRoutes } from '@/constants/routes'

/**
 * Hook to fetch the current government notification
 * Available to all authenticated users (BCeID and IDIR)
 */
export const useCurrentGovernmentNotification = (options = {}) => {
  const client = useApiService()
  const path = apiRoutes.currentGovernmentNotification

  return useQuery({
    queryKey: ['current-government-notification'],
    queryFn: async () => {
      const response = await client.get(path)
      return response.data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options
  })
}

/**
 * Hook to update the government notification
 * Only available to Compliance Manager IDIR users
 */
export const useUpdateGovernmentNotification = ({ onSuccess, onError } = {}) => {
  const apiService = useApiService()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (notificationData) => {
      const response = await apiService.put(
        apiRoutes.updateGovernmentNotification,
        notificationData
      )
      return response.data
    },
    onMutate: async (notificationData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries(['current-government-notification'])

      // Snapshot the previous value
      const previousNotification = queryClient.getQueryData(['current-government-notification'])

      // Optimistically update to the new value
      // If there's no previous notification, create a temporary one with the form data
      queryClient.setQueryData(['current-government-notification'], (old) => {
        if (!old) {
          // Creating first notification - use form data with temporary ID
          return {
            government_notification_id: -1, // Temporary ID
            ...notificationData,
            create_date: new Date().toISOString(),
            update_date: new Date().toISOString(),
            create_user: 'Current User',
            update_user: 'Current User'
          }
        }
        // Updating existing notification
        return {
          ...old,
          ...notificationData
        }
      })

      // Return context with the snapshotted value
      return { previousNotification }
    },
    onSuccess: (data, variables, context) => {
      // Update with the actual server response
      queryClient.setQueryData(['current-government-notification'], data)
      if (onSuccess) {
        onSuccess(data)
      }
    },
    onError: (error, variables, context) => {
      // Rollback to the previous value on error
      if (context?.previousNotification) {
        queryClient.setQueryData(['current-government-notification'], context.previousNotification)
      }
      if (onError) {
        onError(error)
      }
    },
    onSettled: (data, error) => {
      // Only invalidate on error to trigger a refetch
      // On success, we already have the correct data from onSuccess
      if (error) {
        queryClient.invalidateQueries(['current-government-notification'])
      }
    }
  })
}

/**
 * Hook to delete the government notification
 * Only available to Compliance Manager and Director IDIR users
 */
export const useDeleteGovernmentNotification = ({ onSuccess, onError } = {}) => {
  const apiService = useApiService()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const response = await apiService.delete(
        apiRoutes.deleteGovernmentNotification
      )
      return response.data
    },
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries(['current-government-notification'])

      // Snapshot the previous value
      const previousNotification = queryClient.getQueryData([
        'current-government-notification'
      ])

      // Optimistically set to null (deleted)
      queryClient.setQueryData(['current-government-notification'], null)

      // Return context with the snapshotted value
      return { previousNotification }
    },
    onSuccess: (data, variables, context) => {
      // Ensure the cache is set to null
      queryClient.setQueryData(['current-government-notification'], null)
      if (onSuccess) {
        onSuccess(data)
      }
    },
    onError: (error, variables, context) => {
      // Rollback to the previous value on error
      if (context?.previousNotification) {
        queryClient.setQueryData(
          ['current-government-notification'],
          context.previousNotification
        )
      }
      if (onError) {
        onError(error)
      }
    },
    onSettled: (data, error) => {
      // Only invalidate on error to trigger a refetch
      if (error) {
        queryClient.invalidateQueries(['current-government-notification'])
      }
    }
  })
}
