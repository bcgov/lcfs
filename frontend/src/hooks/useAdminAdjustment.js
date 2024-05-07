import { useApiService } from '@/services/useApiService'
import { ADMIN_ADJUSTMENT } from '@/views/Transactions/AddEditViewTransaction'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const useAdminAdjustment = (adminAdjustmentID, options) => {
  const client = useApiService()

  return useQuery({
    queryKey: [ADMIN_ADJUSTMENT, adminAdjustmentID],
    queryFn: async () => (await client.get(`/admin_adjustments/${adminAdjustmentID}`)).data,
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
        return await client.put(`admin_adjustments/${adminAdjustmentId}`, data)
      } else {
        return await client.post('admin_adjustments/', data)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries([ADMIN_ADJUSTMENT, adminAdjustmentId])
    }
  })
}
