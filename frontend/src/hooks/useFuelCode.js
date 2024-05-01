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

export const useAddFuelCodes = (options) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    ...options,
    mutationFn: async ({ data }) => {
      // Check if data is an array and isValid is true for all rows
      if (!Array.isArray(data) || !data.every(item => item.isValid)) {
        throw new Error('All fuel codes must be validated before saving.');
      }
      await client.post(apiRoutes.addFuelCodes, data)
    },
    onSettled: () => {
      queryClient.invalidateQueries(['fuel-codes'])
    }
  })
}