import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const useFuelCodeOptions = (params, options) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['fuel-code-options'],
    queryFn: async () => (await client.get(apiRoutes.fuelCodeOptions)).data,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    ...options
  })
}

export const useGetFuelCode = (fuelCodeID, options) => {
  const client = useApiService()
  return useQuery({
    enabled: !!fuelCodeID,
    queryKey: ['fuel-code', fuelCodeID],
    queryFn: async () => {
      return (
        await client.get(
          apiRoutes.getFuelCode.replace(':fuelCodeId', fuelCodeID)
        )
      ).data
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    ...options
  })
}

export const useGetFuelCodes = (
  { page = 1, size = 10, sortOrders = [], filters = [] } = {},
  options
) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['fuel-codes', page, size, sortOrders, filters],
    queryFn: async () => {
      return (
        await client.post(apiRoutes.getFuelCodes, {
          page,
          size,
          sortOrders,
          filters
        })
      ).data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    ...options
  })
}

export const useFuelCodeStatuses = (options) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['fuel-code-statuses'],
    queryFn: async () => {
      const response = await client.get('/fuel-codes/statuses')
      return response.data
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    ...options
  })
}

export const useTransportModes = (options) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['transport-modes'],
    queryFn: async () => {
      const response = await client.get('/fuel-codes/transport-modes')
      return response.data
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    ...options
  })
}

// Single unified mutation hook for all fuel code operations
export const useFuelCodeMutation = (options = {}) => {
  const client = useApiService()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ action, data, fuelCodeId }) => {
      switch (action) {
        case 'create':
        case 'save':
          return await client.post(apiRoutes.saveFuelCode, data)

        case 'update':
        case 'approve':
          if (!fuelCodeId)
            throw new Error('fuelCodeId is required for update operation')
          return await client.put(
            apiRoutes.updateFuelCodeStatus.replace(':fuelCodeId', fuelCodeId),
            data
          )

        case 'delete':
          if (!fuelCodeId)
            throw new Error('fuelCodeId is required for delete operation')
          return await client.delete(
            apiRoutes.deleteFuelCode.replace(':fuelCodeId', fuelCodeId)
          )

        case 'download':
          if (!data?.format || !data?.body) {
            throw new Error(
              'format and body are required for download operation'
            )
          }
          return await client.download({
            url: apiRoutes.exportFuelCodes,
            method: 'post',
            params: { format: data.format },
            data: data.body
          })

        default:
          throw new Error(`Unknown action: ${action}`)
      }
    },
    onSuccess: (data, variables) => {
      const { action, fuelCodeId } = variables

      // Invalidate relevant queries based on the action
      switch (action) {
        case 'create':
          // Invalidate fuel codes list and options to get updated nextFuelCode
          queryClient.invalidateQueries({ queryKey: ['fuel-codes'] })
          queryClient.invalidateQueries({ queryKey: ['fuel-code-options'] })
          break

        case 'update':
          // Invalidate specific fuel code, lists, and options
          if (fuelCodeId) {
            queryClient.invalidateQueries({
              queryKey: ['fuel-code', fuelCodeId]
            })
          }
          queryClient.invalidateQueries({ queryKey: ['fuel-codes'] })
          queryClient.invalidateQueries({ queryKey: ['fuel-code-options'] })
          break

        case 'approve':
          // Invalidate specific fuel code, lists, and statuses
          if (fuelCodeId) {
            queryClient.invalidateQueries({
              queryKey: ['fuel-code', fuelCodeId]
            })
          }
          queryClient.invalidateQueries({ queryKey: ['fuel-codes'] })
          queryClient.invalidateQueries({ queryKey: ['fuel-code-statuses'] })
          break

        case 'delete':
          // Remove specific fuel code from cache and invalidate lists
          if (fuelCodeId) {
            queryClient.removeQueries({ queryKey: ['fuel-code', fuelCodeId] })
          }
          queryClient.invalidateQueries({ queryKey: ['fuel-codes'] })
          queryClient.invalidateQueries({ queryKey: ['fuel-code-options'] })
          break

        case 'download':
          // No cache invalidation needed for downloads
          break
      }
    },
    ...options
  })
}

// Convenience hooks for backward compatibility (optional)
export const useCreateFuelCode = (options) => {
  const mutation = useFuelCodeMutation(options)
  return {
    ...mutation,
    mutateAsync: (data) => mutation.mutateAsync({ action: 'create', data })
  }
}

export const useUpdateFuelCode = (fuelCodeId, options) => {
  const mutation = useFuelCodeMutation(options)
  return {
    ...mutation,
    mutateAsync: (data) =>
      mutation.mutateAsync({ action: 'update', data, fuelCodeId })
  }
}

export const useDeleteFuelCode = (options) => {
  const mutation = useFuelCodeMutation(options)
  return {
    ...mutation,
    mutateAsync: (fuelCodeId) =>
      mutation.mutateAsync({ action: 'delete', fuelCodeId })
  }
}

export const useApproveFuelCode = (options) => {
  const mutation = useFuelCodeMutation(options)
  return {
    ...mutation,
    mutateAsync: (fuelCodeId) =>
      mutation.mutateAsync({ action: 'approve', fuelCodeId })
  }
}

export const useDownloadFuelCodes = (options) => {
  const mutation = useFuelCodeMutation(options)
  return {
    ...mutation,
    mutateAsync: (data) => mutation.mutateAsync({ action: 'download', data })
  }
}
