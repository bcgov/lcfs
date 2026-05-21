import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useCurrentUser } from './useCurrentUser'
import { roles } from '@/constants/roles'
import { TRANSFER_STATUSES } from '@/constants/statuses'
import { apiRoutes } from '@/constants/routes'
import type { QueryOptions , ExtMutationOptions} from './types'

export const useTransaction = (transactionID: number | string | undefined | null, options: QueryOptions<unknown>) => {
  const client = useApiService()

  return useQuery({
    queryKey: ['transaction', transactionID],
    queryFn: async () =>
      (await client.get(`/transactions/${transactionID}`)).data,
    ...options
  })
}

export const useTransactionStatuses = (options: QueryOptions<unknown>) => {
  const client = useApiService()
  const { hasAnyRole } = useCurrentUser()

  return useQuery({
    queryKey: ['transaction-statuses'],
    queryFn: async () => {
      const optionsData = await client.get('/transactions/statuses/')
      if (hasAnyRole(roles.supplier)) {
        return optionsData.data.filter(
          (val: any) => val.status !== TRANSFER_STATUSES.RECOMMENDED
        )
      } else {
        return optionsData.data.filter(
          (val: any) =>
            ![TRANSFER_STATUSES.DELETED, TRANSFER_STATUSES.SENT].includes(
              val.status
            )
        )
      }
    },
    ...options
  })
}

export const useGetTransactionList = ({ page = 1, size = 10, sortOrders = [], filters = [], selectedOrgId }: any = {}, options: QueryOptions<unknown>) => {
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

export const useTransactionDocuments = (parentID: number | string | undefined | null, parentType: string, options: QueryOptions<unknown>) => {
  const client = useApiService()

  return useQuery({
    queryKey: ['documents', parentType, parentID],
    queryFn: async () => {
      const path = apiRoutes.getDocuments
        .replace(':parentID', String(parentID ?? ''))
        .replace(':parentType', String(parentType ?? ''))

      const res = await client.get(path)
      return res.data
    },
    ...options
  })
}

export const useDownloadTransactions = (options: ExtMutationOptions<unknown, any>) => {
  const client = useApiService()
  return useMutation({
    ...options,
    mutationFn: async ({ format, body, endpoint }: any) => {
      return await client.download({
        url: endpoint,
        method: 'post',
        params: { format },
        data: body
      })
    }
  })
}
