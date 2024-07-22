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
export const useFuelCodeSearch = (params, options) => {
  const client = useApiService()
  let path = apiRoutes.fuelCodeSearch
  // eslint-disable-next-line chai-friendly/no-unused-expressions, no-return-assign
  params && Object.keys(params.queryParams).forEach(key => path += (params.queryParams[key] && params.queryParams[key] !== '') ? `${key}=${params.queryParams[key]}&` : '')
  return useQuery({
    queryKey: ['fuel-code-search'],
    queryFn: async () => {
      const response = await client.get(path)
      return response.data
    },
    enabled: params?.options?.enabled,
    retry: params.options.retry,
    ...options
  })
}

export const useAddFuelCodes = (options) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    ...options,
    mutationFn: async ({ data }) => {
      // Check if data is an array and isValid is true for all rows
      if (!Array.isArray(data) || !data.every((item) => item.isValid)) {
        throw new Error('All fuel codes must be validated before saving.')
      }
      await client.post(apiRoutes.addFuelCodes, data)
    },
    onSettled: () => {
      queryClient.invalidateQueries(['fuel-codes'])
    }
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
    },
  })
}