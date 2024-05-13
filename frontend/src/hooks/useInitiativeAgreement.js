import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { INITIATIVE_AGREEMENT } from '@/views/Transactions/AddEditViewTransaction'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const useInitiativeAgreement = (initiativeAgreementID, options) => {
  const client = useApiService()

  return useQuery({
    queryKey: [INITIATIVE_AGREEMENT, initiativeAgreementID],
    queryFn: async () => (await client.get(`${apiRoutes.initiativeAgreements}${initiativeAgreementID}`)).data,
    ...options
  })
}

export const useCreateUpdateInitiativeAgreement = (initiativeAgreementId, options) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    ...options,
    mutationFn: async ({ data }) => {
      if (initiativeAgreementId) {
        data.initiativeAgreementId = initiativeAgreementId
        return await client.put(apiRoutes.initiativeAgreements, data)
      } else {
        return await client.post(apiRoutes.initiativeAgreements, data)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries([INITIATIVE_AGREEMENT, initiativeAgreementId])
    }
  })
}
