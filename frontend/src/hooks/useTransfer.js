import { useApiService } from '@/services/useApiService'
import { useQuery } from '@tanstack/react-query'

export const useTransfer = (transferID, options) => {
  const client = useApiService()

  return useQuery({
    queryKey: ['transfer', transferID],
    queryFn: async () => (await client.get(`/transfers/${transferID}`)).data,
    ...options
  })
}
