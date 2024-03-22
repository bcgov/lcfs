import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery } from '@tanstack/react-query'

export const useTransfer = (transferID, options) => {
  const client = useApiService()

  return useQuery({
    queryKey: ['transfer', transferID],
    queryFn: async () => (await client.get(`/transfers/${transferID}`)).data,
    ...options
  })
}


export const useCreateUpdateTransfer = (orgId, transferId, options) => {
  const client = useApiService()

  return useMutation({
    ...options,
    mutationFn: async ({ data }) => {

      return orgId ? (transferId ?
        await client.put(`organization/${orgId}/transfers/${transferId}`, data) : await client.post(`organization/${orgId}/transfers`, data)) :
        await client.put(`transfers/${transferId}`, data)
    }
  })
}