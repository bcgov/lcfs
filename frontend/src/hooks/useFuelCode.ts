import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryOptions, PaginationParams, ExtMutationOptions } from './types'

export const useFuelCodeOptions = (_params: Record<string, any>, options: QueryOptions<unknown>) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['fuel-code-options'],
    queryFn: async () => (await client.get(apiRoutes.fuelCodeOptions)).data,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    ...options
  })
}

export const useGetFuelCode = (fuelCodeID: any, options: QueryOptions<unknown>) => {
  const client = useApiService()
  return useQuery({
    enabled: !!fuelCodeID,
    queryKey: ['fuel-code', fuelCodeID],
    queryFn: async () => {
      return (
        await client.get(
          apiRoutes.getFuelCode.replace(':fuelCodeId', String(fuelCodeID ?? ''))
        )
      ).data
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    ...options
  })
}

export const useGetFuelCodes = ({ page = 1, size = 10, sortOrders = [], filters = [], excludeArchived = false }: any = {}, options: QueryOptions<unknown>) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['fuel-codes', page, size, sortOrders, filters, excludeArchived],
    queryFn: async () => {
      return (
        await client.post(
          apiRoutes.getFuelCodes,
          {
            page,
            size,
            sortOrders,
            filters
          },
          { params: excludeArchived ? { excludeArchived: true } : undefined }
        )
      ).data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    ...options
  })
}

export const useFuelCodeStatuses = (options: QueryOptions<unknown>) => {
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

export const useFuelCodeBulletins = (bulletinType: any, paginationOptions: PaginationParams, options: QueryOptions<unknown>) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['fuel-code-bulletins', bulletinType, paginationOptions],
    queryFn: async () => {
      const response = await client.post(
        `/fuel-codes/bulletins?bulletinType=${bulletinType}`,
        {
          page: paginationOptions.page || 1,
          size: paginationOptions.size || 25,
          sortOrders: paginationOptions.sortOrders || [],
          filters: paginationOptions.filters || []
        }
      )
      return response.data
    },
    enabled: !!bulletinType,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    ...options
  })
}

export const useDownloadFuelCodeBulletins = (options: ExtMutationOptions<unknown, any>) => {
  const client = useApiService()
  return useMutation({
    mutationFn: async ({ bulletinType, format = 'xlsx', body }: any) => {
      if (!bulletinType) {
        throw new Error('bulletinType is required for bulletin download')
      }

      return await client.download({
        url: apiRoutes.exportFuelCodeBulletins,
        method: 'post',
        params: { bulletinType, format },
        data: body
      })
    },
    ...options
  })
}

export const useTransportModes = (options: QueryOptions<unknown>) => {
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
export const useFuelCodeMutation = (options: ExtMutationOptions<unknown, any> = {}) => {
  const client = useApiService()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ action, data, fuelCodeId }: any) => {
      switch (action) {
        case 'create':
        case 'save':
          return await client.post(apiRoutes.saveFuelCode, data)

        case 'update':
        case 'approve':
          if (!fuelCodeId)
            throw new Error('fuelCodeId is required for update operation')
          return await client.put(
            apiRoutes.updateFuelCodeStatus.replace(':fuelCodeId', String(fuelCodeId ?? '')),
            data
          )

        case 'delete':
          if (!fuelCodeId)
            throw new Error('fuelCodeId is required for delete operation')
          return await client.delete(
            apiRoutes.deleteFuelCode.replace(':fuelCodeId', String(fuelCodeId ?? ''))
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
            params: {
              format: data.format,
              ...(data.excludeArchived ? { excludeArchived: true } : {})
            },
            data: data.body
          })

        default:
          throw new Error(`Unknown action: ${action}`)
      }
    },
    onSuccess: (_data, variables) => {
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
export const useCreateFuelCode = (options: ExtMutationOptions<unknown, any>) => {
  const mutation = useFuelCodeMutation(options)
  return {
    ...mutation,
    mutateAsync: (data: any) => mutation.mutateAsync({ action: 'create', data })
  }
}

export const useUpdateFuelCode = (fuelCodeId: any, options: ExtMutationOptions<unknown, any>) => {
  const mutation = useFuelCodeMutation(options)
  return {
    ...mutation,
    mutateAsync: (data: any) =>
      mutation.mutateAsync({ action: 'update', data, fuelCodeId })
  }
}

export const useDeleteFuelCode = (options: ExtMutationOptions<unknown, any>) => {
  const mutation = useFuelCodeMutation(options)
  return {
    ...mutation,
    mutateAsync: (fuelCodeId: any) =>
      mutation.mutateAsync({ action: 'delete', fuelCodeId })
  }
}

export const useApproveFuelCode = (options: ExtMutationOptions<unknown, any>) => {
  const mutation = useFuelCodeMutation(options)
  return {
    ...mutation,
    mutateAsync: (fuelCodeId: any) =>
      mutation.mutateAsync({ action: 'approve', fuelCodeId })
  }
}

export const useDownloadFuelCodes = (options: ExtMutationOptions<unknown, any>) => {
  const mutation = useFuelCodeMutation(options)
  return {
    ...mutation,
    mutateAsync: (data: any) => mutation.mutateAsync({ action: 'download', data })
  }
}
