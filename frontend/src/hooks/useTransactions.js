import { useApiService } from '@/services/useApiService'
import { useQuery } from '@tanstack/react-query'
import { useCurrentUser } from './useCurrentUser'
import { roles } from '@/constants/roles'
import { TRANSFER_STATUSES } from '@/constants/statuses'
import { apiRoutes } from '@/constants/routes'

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
  const { hasAnyRole } = useCurrentUser()

  return useQuery({
    queryKey: ['transaction-statuses'],
    queryFn: async () => {
      const optionsData = await client.get('/transactions/statuses/')
      if (hasAnyRole(roles.supplier)) {
        return optionsData.data.filter(
          (val) => val.status !== TRANSFER_STATUSES.RECOMMENDED
        )
      } else {
        return optionsData.data.filter(
          (val) =>
            ![TRANSFER_STATUSES.DELETED, TRANSFER_STATUSES.SENT].includes(
              val.status
            )
        )
      }
    },
    ...options
  })
}

export const useGetTransactionList = (
  { page = 1, size = 10, sortOrders = [], filters = [], selectedOrgId } = {},
  options
) => {
  const client = useApiService()
  const { hasRoles, isLoading } = useCurrentUser()

  return useQuery({
    enabled: !isLoading,
    queryKey: [
      'transactions-list',
      page,
      size,
      sortOrders,
      filters,
      selectedOrgId
    ],
    queryFn: async () => {
      const getApiEndpoint = () => {
        if (hasRoles(roles.supplier)) {
          return apiRoutes.orgTransactions
        } else if (selectedOrgId) {
          return apiRoutes.filteredTransactionsByOrg.replace(
            ':orgID',
            selectedOrgId
          )
        }
        return apiRoutes.transactions
      }
      return (
        await client.post(getApiEndpoint(), {
          page,
          size,
          sortOrders,
          filters
        })
      ).data
    },
    ...options
  })
}

export const useTransactionDocuments = (parentID, parentType, options) => {
  const client = useApiService()

  return useQuery({
    queryKey: ['documents', parentType, parentID],
    queryFn: async () => {
      const path = apiRoutes.getDocuments
        .replace(':parentID', parentID)
        .replace(':parentType', parentType)

      const res = await client.get(path)
      return res.data
    },
    ...options
  })
}
