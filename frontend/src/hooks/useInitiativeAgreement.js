import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const useInitiativeAgreement = (initiativeAgreementID, options) => {
  const client = useApiService()

  return useQuery({
    queryKey: ['initiativeAgreement', initiativeAgreementID],
    queryFn: async () => (await client.get(`/initiative_agreements/${initiativeAgreementID}`)).data,
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
        return await client.put(`initiative_agreements/${initiativeAgreementId}`, data)
      } else {
        return await client.post('initiative_agreements', data)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries(['initiativeAgreement', initiativeAgreementId])
    }
  })
}
