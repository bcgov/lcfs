import { useApiService } from '@/services/useApiService'
import { useQuery } from '@tanstack/react-query'
import { useCurrentUser } from './useCurrentUser'
import { roles } from '@/constants/roles'
import { TRANSFER_STATUSES } from '@/constants/statuses'

export const useTransaction = (transactionID, options) => {
  const client = useApiService()

  return useQuery({
    queryKey: ['transaction', transactionID],
    queryFn: async () =>
      (await client.get(`/transactions/${transactionID}`)).data,
    ...options
  })
}

export const useTransactionStatuses = (options) => {
  const client = useApiService()
  const { hasRoles } = useCurrentUser()

  return useQuery({
    queryKey: ['transaction-statuses'],
    queryFn: async () => {
      const optionsData = await client.get('/transactions/statuses/')
      if (hasRoles(roles.supplier)) {
        return optionsData.data.filter(
          (val) => val.status !== TRANSFER_STATUSES.RECOMMENDED
        )
      } else {
        return optionsData.data.filter(
          (val) =>
            ![
              TRANSFER_STATUSES.DELETED,
              TRANSFER_STATUSES.DRAFT,
              TRANSFER_STATUSES.SENT
            ].includes(val.status)
        )
      }
    },
    ...options
  })
}
