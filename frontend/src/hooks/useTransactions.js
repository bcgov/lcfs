import { useApiService } from '@/services/useApiService'
import { useQuery } from '@tanstack/react-query'
import { useCurrentUser } from './useCurrentUser'
import { roles } from '@/constants/roles'
import { TRANSFER_STATUSES } from '@/constants/statuses'

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

export const useTransactionsOrgTransfersInProgress = (orgID, options) => {
  const client = useApiService()

  return useQuery({
    queryKey: ['transaction-org-transfers-in-progress', orgID],
    queryFn: async () => 
      (await client.get(`/organization/${orgID}/count-transfers-in-progress`)).data,
    ...options
  })
}

export const useTransactionsTransfersInProgress = (options) => {
  const client = useApiService()

  return useQuery({
    queryKey: ['transaction-transfers-in-progress'],
    queryFn: async () => 
      (await client.get(`/transactions/count-transfers-in-progress`)).data,
    ...options
  })
}

export const useTransactionsInitiativeAgreementsInProgress = (options) => {
  const client = useApiService()

  return useQuery({
    queryKey: ['transaction-initiative-agreements-in-progress'],
    queryFn: async () => 
      (await client.get(`/transactions/count-initiative-agreements-in-progress`)).data,
    ...options
  })
}

export const useTransactionsAdminAdjustmentsInProgress = (options) => {
  const client = useApiService()

  return useQuery({
    queryKey: ['transaction-admin-adjustments-in-progress'],
    queryFn: async () => 
      (await client.get(`/transactions/count-admin-adjustments-in-progress`)).data,
    ...options
  })
}
