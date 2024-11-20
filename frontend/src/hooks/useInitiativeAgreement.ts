import {
  InitiativeAgreementCreateSchema,
  InitiativeAgreementsService,
  InitiativeAgreementUpdateSchema
} from '@/services/apiClient'
import { INITIATIVE_AGREEMENT } from '@/views/Transactions/constants'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const useInitiativeAgreement = ({
  adminAdjustmentId
}: {
  adminAdjustmentId: number | undefined
}) => {
  return useQuery({
    enabled: !!adminAdjustmentId,
    queryKey: [INITIATIVE_AGREEMENT, adminAdjustmentId],
    queryFn: async () => {
      try {
        if (!adminAdjustmentId) {
          return
        }
        const { data } =
          await InitiativeAgreementsService.getInitiativeAgreement({
            path: { initiative_agreement_id: adminAdjustmentId }
          })
        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}

export const useCreateUpdateInitiativeAgreement = ({
  initiativeAgreementId
}: {
  initiativeAgreementId?: number
}) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (
      data: InitiativeAgreementUpdateSchema | InitiativeAgreementCreateSchema
    ) => {
      try {
        if (initiativeAgreementId) {
          await InitiativeAgreementsService.updateInitiativeAgreement({
            body: { ...data, initiativeAgreementId }
          })
        } else {
          await InitiativeAgreementsService.createInitiativeAgreement({
            body: data
          })
        }
      } catch (error) {
        console.log(error)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: [initiativeAgreementId]
      })
    }
  })
}
