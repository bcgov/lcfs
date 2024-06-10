import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const useNotionalTransferOptions = (params, options) => {
  const client = useApiService()
  const path = apiRoutes.notionalTransferOptions
  return useQuery({
    queryKey: ['notional-transfer-options'],
    queryFn: async () => (await client.get(path)).data,
    ...options
  })
}

export const useAddNotionalTransfers = (options) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    ...options,
    mutationFn: async ({ data }) => {
      // Check if data is an array and isValid is true for all rows
      if (!Array.isArray(data) || !data.every((item) => item.isValid)) {
        throw new Error('All notional transfers must be validated before saving.')
      }
      await client.post(apiRoutes.addNotionalTransfers, data)
    },
    onSettled: () => {
      queryClient.invalidateQueries(['notional-transfers'])
    }
  })
}

export const useGetNotionalTransfer = (notionalTransferID) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['notional-transfer', notionalTransferID],
    queryFn: async () => {
      return (
        await client.get(
          apiRoutes.getNotionalTransfer.replace(':notionalTransferID', notionalTransferID)
        )
      ).data
    }
  })
}

export const useUpdateNotionalTransfer = (notionalTransferID, options) => {
  const client = useApiService()
  return useMutation({
    ...options,
    mutationFn: async (data) => {
      return await client.put(
        apiRoutes.updateNotionalTransfer.replace(':notionalTransferID', notionalTransferID),
        data
      )
    }
  })
}

export const useDeleteNotionalTransfer = (notionalTransferID, options) => {
  const client = useApiService()
  return useMutation({
    ...options,
    mutationFn: async () => {
      return await client.delete(
        apiRoutes.updateNotionalTransfer.replace(':notionalTransferID', notionalTransferID)
      )
    }
  })
}
