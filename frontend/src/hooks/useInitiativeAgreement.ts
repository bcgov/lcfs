import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { INITIATIVE_AGREEMENT } from '@/views/Transactions/constants'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryOptions , ExtMutationOptions} from './types'

export const useInitiativeAgreement = (initiativeAgreementID: number | string | undefined | null, options: QueryOptions<unknown>) => {
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

export const useCreateUpdateInitiativeAgreement = (initiativeAgreementId: number | string | undefined | null, options: ExtMutationOptions<unknown, any>) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    ...options,
    mutationFn: async ({ data }: any) => {
      if (initiativeAgreementId) {
        data.initiativeAgreementId = initiativeAgreementId
        return await client.put(apiRoutes.initiativeAgreements, data)
      } else {
        return await client.post(apiRoutes.initiativeAgreements, data)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [ INITIATIVE_AGREEMENT, initiativeAgreementId ] })
    }
  })
}
