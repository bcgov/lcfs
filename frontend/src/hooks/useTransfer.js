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

export const useUpdateTransfer = (transferID, options) => {
  const client = useApiService()

  return useMutation({
    ...options,
    mutationFn: async ({ comments, newStatus }) => {
      await client.put(`/transfers/${transferID}`, {
        comments,
        current_status_id: newStatus
      })
    }
  })
}
