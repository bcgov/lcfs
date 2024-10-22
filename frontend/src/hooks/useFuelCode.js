import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const useFuelCodeOptions = (params, options) => {
  const client = useApiService()
  const path = apiRoutes.fuelCodeOptions
  return useQuery({
    queryKey: ['fuel-code-options'],
    queryFn: async () => (await client.get(path)).data,
    ...options
  })
}


export const useGetFuelCode = (fuelCodeID) => {
  const client = useApiService()
  // const queryClient = useQueryClient()
  return useQuery({
    queryKey: ['fuel-code', fuelCodeID],
    queryFn: async () => {
      return (
        await client.get(
          apiRoutes.getFuelCode.replace(':fuelCodeId', fuelCodeID)
        )
      ).data
    }
  })
}

export const useUpdateFuelCode = (fuelCodeID, options) => {
  const client = useApiService()
  return useMutation({
    ...options,
    mutationFn: async (data) => {
      return await client.put(
        apiRoutes.updateFuelCode.replace(':fuelCodeId', fuelCodeID),
        data
      )
    }
  })
}

export const useDeleteFuelCode = (fuelCodeID, options) => {
  const client = useApiService()
  return useMutation({
    ...options,
    mutationFn: async () => {
      return await client.delete(
        apiRoutes.updateFuelCode.replace(':fuelCodeId', fuelCodeID)
      )
    }
  })
}

export const useSaveFuelCode = (options) => {
  const client = useApiService()
  const queryClient = useQueryClient()

  return useMutation({
    ...options,
    mutationFn: async (data) => {
      return await client.post(apiRoutes.saveFuelCode, data)
    },
    onSettled: () => {
      queryClient.invalidateQueries(['fuel-codes'])
    }
  })
}

export const useGetFuelCodes = (
  { page = 1, size = 10, sortOrders = [], filters = [] } = {},
  options
) => {
  const client = useApiService()

  return useQuery({
    ...options,
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
    }
  })
}
