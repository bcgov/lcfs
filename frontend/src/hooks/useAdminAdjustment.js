import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { ADMIN_ADJUSTMENT } from '@/views/Transactions/constants'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const useAdminAdjustment = (adminAdjustmentID, options) => {
  const client = useApiService()

  return useQuery({
    queryKey: [ADMIN_ADJUSTMENT, adminAdjustmentID],
    queryFn: async () =>
      (await client.get(`${apiRoutes.adminAdjustments}${adminAdjustmentID}`))
        .data,
    ...options
  })
}

export const useCreateUpdateAdminAdjustment = (adminAdjustmentId, options) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    ...options,
    mutationFn: async ({ data }) => {
      if (adminAdjustmentId) {
        data.adminAdjustmentId = adminAdjustmentId
        return await client.put(apiRoutes.adminAdjustments, data)
      } else {
        return await client.post(apiRoutes.adminAdjustments, data)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries([ADMIN_ADJUSTMENT, adminAdjustmentId])
    }
  })
}
