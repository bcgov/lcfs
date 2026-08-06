import { useQuery } from '@tanstack/react-query'
import { useApiService } from '@/services/useApiService'
import { apiRoutes } from '@/constants/routes/apiRoutes'
import type { QueryOptions } from './types'

export const useCreditLedger = (
  {
    orgId,
    page = 1,
    size = 10,
    period,
    sortOrders = [],
    extraFilters = []
  }: any = {},
  options: QueryOptions<unknown>
) => {
  const api = useApiService()

  return useQuery({
    queryKey: [
      'credit-ledger',
      orgId,
      page,
      size,
      period,
      sortOrders,
      extraFilters
    ],
    enabled: !!orgId,
    queryFn: async () => {
      const body = {
        page,
        size,
        sortOrders,
        filters: [...extraFilters]
      }

      if (period) {
        body.filters.push({
          field: 'compliance_period',
          filter: String(period),
          type: 'equals',
          filterType: 'text'
        })
      }

      const url = apiRoutes.creditLedger.replace(':orgID', String(orgId ?? ''))
      const { data } = await api.post(url, body)
      return data
    },
    ...options
  })
}

export const usePeriodCreditLedger = (
  {
    orgId,
    complianceYear,
    includePending = false
  }: {
    orgId?: number | string | null
    complianceYear?: number | string | null
    includePending?: boolean
  } = {},
  options: QueryOptions<unknown> = {}
) => {
  const api = useApiService()

  return useQuery({
    queryKey: ['period-credit-ledger', orgId, complianceYear, includePending],
    enabled: !!orgId && !!complianceYear,
    queryFn: async () => {
      const url = apiRoutes.creditLedgerPeriod
        .replace(':orgID', String(orgId ?? ''))
        .replace(':year', String(complianceYear ?? ''))
      const { data } = await api.get(url, {
        params: { include_pending: includePending }
      })
      return data
    },
    ...options
  })
}

export const useDownloadCreditLedger = (apiOpts: any) => {
  const api = useApiService(apiOpts)
  return ({ orgId, format = 'xlsx' }: any) =>
    api.download({
      url: apiRoutes.exportCreditLedger.replace(':orgID', String(orgId ?? '')),
      method: 'get',
      params: {
        format
      }
    })
}

export const useCreditLedgerYears = (
  orgId: number | string | undefined | null,
  options: QueryOptions<unknown>
) => {
  const api = useApiService()

  return useQuery({
    queryKey: ['credit-ledger-years', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const url = apiRoutes.creditLedgerYears.replace(
        ':orgID',
        String(orgId ?? '')
      )
      const { data } = await api.get(url)
      return data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    ...options
  })
}
