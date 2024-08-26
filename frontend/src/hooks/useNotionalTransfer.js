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

export const useGetAllNotionalTransfers = (complianceReportId, options) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['notional-transfers', complianceReportId],
    queryFn: async () => {
      return (
        await client.post(apiRoutes.getAllNotionalTransfers, { complianceReportId })
      ).data.notionalTransfers
    },
    ...options
  })
}

export const useSaveNotionalTransfer = (complianceReportId, options) => {
  const client = useApiService()
  const queryClient = useQueryClient()

  return useMutation({
    ...options,
    mutationFn: async (data) => {
      return await client.post(apiRoutes.saveNotionalTransfer, data)
    },
    onSettled: () => {
      queryClient.invalidateQueries(['notional-transfers', `compliance-report-summary-${complianceReportId}`])
    },
  })
}

export const useGetNotionalTransfers = ({page=1, size=10, sortOrders=[], filters=[], complianceReportId} ={}, options) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['notional-transfers', page, size, sortOrders, filters],
    queryFn: async () => {
      return (
        await client.post(apiRoutes.getNotionalTransfers, {page, size, sortOrders, filters, complianceReportId})
      ).data
    },
    ...options
  })
}