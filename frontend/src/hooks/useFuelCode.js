import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const useFuelCodeOptions = (params, options) => {
  const client = useApiService()
  const path = apiRoutes.fuelCodeOptions
  return useQuery({
    queryKey: ['fuel-code-options'],
    queryFn: async () => (await client.get(path)).data,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    ...options
  })
}

export const useGetFuelCode = (fuelCodeID) => {
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
    gcTime: 10 * 60 * 1000 // 10 minutes
  })
}

export const useCreateFuelCode = (options) => {
  const client = useApiService()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data) => {
      return await client.post(apiRoutes.saveFuelCode, data)
    },
    onSuccess: () => {
      // Invalidate and refetch fuel codes list
      queryClient.invalidateQueries({ queryKey: ['fuel-codes'] })
      queryClient.invalidateQueries({ queryKey: ['fuel-code-options'] })
    },
    ...options
  })
}

export const useUpdateFuelCode = (fuelCodeID, options) => {
  const client = useApiService()
  const queryClient = useQueryClient()

  return useMutation({
    enabled: !!fuelCodeID,
    mutationFn: async (data) => {
      return await client.post(apiRoutes.saveFuelCode, {
        ...data,
        fuelCodeID
      })
    },
    onSuccess: () => {
      // Invalidate specific fuel code and lists
      queryClient.invalidateQueries({ queryKey: ['fuel-code', fuelCodeID] })
      queryClient.invalidateQueries({ queryKey: ['fuel-codes'] })
      queryClient.invalidateQueries({ queryKey: ['fuel-code-options'] })
    },
    ...options
  })
}

export const useApproveFuelCode = (options) => {
  const client = useApiService()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (fuelCodeID) => {
      return await client.post(
        apiRoutes.approveFuelCode.replace(':fuelCodeId', fuelCodeID)
      )
    },
    onSuccess: (data, fuelCodeID) => {
      // Invalidate specific fuel code and lists
      queryClient.invalidateQueries({ queryKey: ['fuel-code', fuelCodeID] })
      queryClient.invalidateQueries({ queryKey: ['fuel-codes'] })
      queryClient.invalidateQueries({ queryKey: ['fuel-code-statuses'] })
    },
    ...options
  })
}

export const useDeleteFuelCode = (options) => {
  const client = useApiService()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (fuelCodeID) => {
      return await client.delete(
        apiRoutes.deleteFuelCode.replace(':fuelCodeId', fuelCodeID)
      )
    },
    onSuccess: (data, fuelCodeID) => {
      // Remove from cache and invalidate lists
      queryClient.removeQueries({ queryKey: ['fuel-code', fuelCodeID] })
      queryClient.invalidateQueries({ queryKey: ['fuel-codes'] })
      queryClient.invalidateQueries({ queryKey: ['fuel-code-options'] })
    },
    ...options
  })
}

export const useFuelCodeStatuses = (options) => {
  const client = useApiService()

  return useQuery({
    queryKey: ['fuel-code-statuses'],
    queryFn: async () => {
      const optionsData = await client.get('/fuel-codes/statuses')
      return optionsData.data
    },
    staleTime: 24 * 60 * 60 * 3000, // 24 hours
    gcTime: 24 * 60 * 60 * 3000,
    ...options
  })
}

export const useTransportModes = (options) => {
  const client = useApiService()

  return useQuery({
    queryKey: ['transport-modes'],
    queryFn: async () => {
      const optionsData = await client.get('/fuel-codes/transport-modes')
      return optionsData.data
    },
    staleTime: 24 * 60 * 60 * 3000, // 24 hours
    gcTime: 24 * 60 * 60 * 3000,
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

export const useDownloadFuelCodes = (options) => {
  const client = useApiService()
  return useMutation({
    mutationFn: async ({ format, body }) => {
      return await client.download({
        url: apiRoutes.exportFuelCodes,
        method: 'post',
        params: { format },
        data: body
      })
    },
    ...options
  })
}
