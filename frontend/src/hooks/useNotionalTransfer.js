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

export const useGetNotionalTransfers = (complianceReportId, options) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['notional-transfers', complianceReportId],
    queryFn: async () => {
      return (
        await client.post(apiRoutes.getNotionalTransfers, { complianceReportId })
      ).data.notionalTransfers
    },
    ...options
  })
}

export const useSaveNotionalTransfer = (options) => {
  const client = useApiService()
  const queryClient = useQueryClient()

  return useMutation({
    ...options,
    mutationFn: async (data) => {
      return await client.post(apiRoutes.saveNotionalTransfer, data)
    },
    onSettled: () => {
      queryClient.invalidateQueries(['notional-transfers'])
    },
  })
}