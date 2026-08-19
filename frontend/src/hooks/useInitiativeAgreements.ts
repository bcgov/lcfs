import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useQuery } from '@tanstack/react-query'
import type { PaginationParams, QueryOptions } from './types'

// Agreement-management hooks for the Initiative Agreements module.
// The legacy singular useInitiativeAgreement.ts serves the outgoing
// credit-award transaction flow and is retired at the transaction-flow
// cutover.

const QUERY_KEYS = {
  list: (pagination: any) => ['initiative-agreements', pagination],
  detail: (id: any) => ['initiative-agreements', 'detail', String(id)]
}

export const useGetInitiativeAgreements = (
  { page = 1, size = 10, sortOrders = [], filters = [] }: PaginationParams = {},
  options: QueryOptions<unknown> = {}
) => {
  const client = useApiService()
  return useQuery({
    queryKey: QUERY_KEYS.list({ page, size, sortOrders, filters }),
    queryFn: async () =>
      (
        await client.post(apiRoutes.getInitiativeAgreementsList, {
          page,
          size,
          sortOrders,
          filters
        })
      ).data,
    staleTime: 60 * 1000,
    ...options
  })
}

export const useGetInitiativeAgreement = (
  initiativeAgreementId: number | string,
  options: QueryOptions<unknown> = {}
) => {
  const client = useApiService()
  return useQuery({
    queryKey: QUERY_KEYS.detail(initiativeAgreementId),
    queryFn: async () =>
      (
        await client.get(
          apiRoutes.getInitiativeAgreement.replace(
            ':initiativeAgreementId',
            String(initiativeAgreementId)
          )
        )
      ).data,
    staleTime: 60 * 1000,
    ...options
  })
}
