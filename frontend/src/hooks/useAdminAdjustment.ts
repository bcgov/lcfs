import {
  AdminAdjustmentCreateSchema,
  AdminAdjustmentSchema,
  AdminAdjustmentsService,
  AdminAdjustmentUpdateSchema
} from '@/services/apiClient'
import { TQueryOptions } from '@/utils/reactQuery'
import { ADMIN_ADJUSTMENT } from '@/views/Transactions/constants'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const useAdminAdjustment = (
  { adminAdjustmentId }: { adminAdjustmentId: number | undefined },
  options?: Pick<
    TQueryOptions<AdminAdjustmentSchema | undefined>,
    'enabled' | 'retry' | 'staleTime'
  >
) => {
  return useQuery({
    queryKey: [ADMIN_ADJUSTMENT, adminAdjustmentId],
    queryFn: async () => {
      try {
        if (!adminAdjustmentId) {
          return
        }
        const { data } = await AdminAdjustmentsService.getAdminAdjustment({
          path: { admin_adjustment_id: adminAdjustmentId }
        })
        return data
      } catch (error) {
        console.log(error)
      }
    },
    ...options
  })
}

export const useCreateUpdateAdminAdjustment = ({
  adminAdjustmentId
}: {
  adminAdjustmentId?: number
}) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (
      data: AdminAdjustmentCreateSchema | AdminAdjustmentUpdateSchema
    ) => {
      try {
        if (adminAdjustmentId) {
          await AdminAdjustmentsService.updateAdminAdjustment({
            body: { ...data, adminAdjustmentId }
          })
        } else {
          await AdminAdjustmentsService.createAdminAdjustment({ body: data })
        }
      } catch (error) {
        console.log(error)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [adminAdjustmentId] })
    }
  })
}
