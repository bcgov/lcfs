import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

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
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
    mutationFn: async ({ data }) => {
      if (orgId && transferId) {
        return await client.put(
          `organization/${orgId}/transfers/${transferId}`,
          data
        )
      }

      if (orgId && !transferId) {
        return await client.post(`organization/${orgId}/transfers`, data)
      }

      if (!orgId) {
        return await client.put(`transfers/${transferId}`, data)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries(['transfer', transferId])
    }
  })
}
