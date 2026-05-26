import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { ADMIN_ADJUSTMENT } from '@/views/Transactions/constants'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryOptions , ExtMutationOptions} from './types'

export const useAdminAdjustment = (adminAdjustmentID: number | string | undefined | null, options: QueryOptions<unknown>) => {
  const client = useApiService()

  return useQuery({
    queryKey: [ADMIN_ADJUSTMENT, adminAdjustmentID],
    queryFn: async () =>
      (await client.get(`${apiRoutes.adminAdjustments}${adminAdjustmentID}`))
        .data,
    ...options
  })
}

export const useCreateUpdateAdminAdjustment = (adminAdjustmentId: number | string | undefined | null, options: ExtMutationOptions<unknown, any>) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    ...options,
    mutationFn: async ({ data }: any) => {
      if (adminAdjustmentId) {
        data.adminAdjustmentId = adminAdjustmentId
        return await client.put(apiRoutes.adminAdjustments, data)
      } else {
        return await client.post(apiRoutes.adminAdjustments, data)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_ADJUSTMENT, adminAdjustmentId] })
    }
  })
}
