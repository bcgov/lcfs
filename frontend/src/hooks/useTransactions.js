import { useApiService } from '@/services/useApiService'
import { useQuery } from '@tanstack/react-query'
// import { useCurrentUser } from './useCurrentUser'

export const useTransaction = (transactionID, options) => {
  const client = useApiService()

  return useQuery({
    queryKey: ['transaction', transactionID],
    queryFn: async () => (await client.get(`/transactions/${transactionID}`)).data,
    ...options
  })
}