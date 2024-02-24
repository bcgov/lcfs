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

export const useTransactionStatuses = (options) => {
  const client = useApiService()

  return useQuery({
    queryKey: ['transaction-statuses'],
    queryFn: async () => (await client.get('/transactions/statuses/')).data,
    ...options
  })
}