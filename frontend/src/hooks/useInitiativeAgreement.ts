import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { INITIATIVE_AGREEMENT } from '@/views/Transactions/constants'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ExtMutationOptions, TransactionQueryOptions } from './types'
import type { AxiosResponse } from 'axios'
import type { TransactionMutationData } from './types'

export const useInitiativeAgreement = (
  initiativeAgreementID: number | string | undefined | null,
  options: TransactionQueryOptions
) => {
  const client = useApiService()

  return useQuery({
    queryKey: [INITIATIVE_AGREEMENT, initiativeAgreementID],
    queryFn: async () =>
      (
        await client.get(
          `${apiRoutes.initiativeAgreements}${initiativeAgreementID}`
        )
      ).data,
    ...options
  })
}

export const useCreateUpdateInitiativeAgreement = (
  initiativeAgreementId: number | string | undefined | null,
  options: ExtMutationOptions<AxiosResponse<TransactionMutationData>, unknown>
) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    ...options,
    mutationFn: async ({ data }: { data: Record<string, unknown> }) => {
      if (initiativeAgreementId) {
        data.initiativeAgreementId = initiativeAgreementId
        return await client.put(apiRoutes.initiativeAgreements, data)
      } else {
        return await client.post(apiRoutes.initiativeAgreements, data)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: [INITIATIVE_AGREEMENT, initiativeAgreementId]
      })
    }
  })
}
