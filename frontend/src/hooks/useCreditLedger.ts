import { useQuery } from '@tanstack/react-query'
import { useApiService } from '@/services/useApiService'
import { apiRoutes } from '@/constants/routes/apiRoutes'
import type { AxiosRequestConfig } from 'axios'
import type { Filter, QueryOptions, SortOrder } from './types'

export interface CreditLedgerTransaction {
  transactionType: string
  description?: string | null
  compliancePeriod: string
  organizationId: number
  complianceUnits: number | string
  availableBalance: number | string | null
  updateDate: string
}

export interface CreditLedgerResponse {
  ledger: CreditLedgerTransaction[]
  pagination: { page: number; size: number; total: number; totalPages: number }
}

export interface PeriodLedgerTransaction {
  transactionId: number
  transactionType: string
  description?: string | null
  effectiveDate?: string | null
  unitsIn: number
  unitsOut: number
  runningBalance: number
  status?: string | null
  isPending: boolean
}

export interface PeriodLedgerResponse {
  organizationId: number
  compliancePeriod: number
  includePending: boolean
  transactions: PeriodLedgerTransaction[]
  totalsByType: {
    transactionType: string
    unitsIn: number
    unitsOut: number
    net: number
  }[]
  totalUnitsIn: number
  totalUnitsOut: number
  totalNet: number
  assessedBalance: {
    previousYear?: number | null
    previousBalance?: number | null
    previousNonAssessment?: boolean
    currentYear: number
    currentBalance?: number | null
    currentNonAssessment?: boolean
  }
}

export const useCreditLedger = (
  {
    orgId,
    page = 1,
    size = 10,
    period,
    sortOrders = [],
    extraFilters = []
  }: {
    orgId?: number | string | null
    page?: number
    size?: number
    period?: number | string | null
    sortOrders?: SortOrder[]
    extraFilters?: Filter[]
  } = {},
  options?: QueryOptions<CreditLedgerResponse>
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
      const { data } = await api.post<CreditLedgerResponse>(url, body)
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
  options: QueryOptions<PeriodLedgerResponse> = {}
) => {
  const api = useApiService()

  return useQuery({
    queryKey: ['period-credit-ledger', orgId, complianceYear, includePending],
    enabled: !!orgId && !!complianceYear,
    queryFn: async () => {
      const url = apiRoutes.creditLedgerPeriod
        .replace(':orgID', String(orgId ?? ''))
        .replace(':year', String(complianceYear ?? ''))
      const { data } = await api.get<PeriodLedgerResponse>(url, {
        params: { include_pending: includePending }
      })
      return data
    },
    ...options
  })
}

export const useDownloadCreditLedger = (apiOpts?: AxiosRequestConfig) => {
  const api = useApiService(apiOpts)
  return ({
    orgId,
    format = 'xlsx'
  }: {
    orgId?: number | string | null
    format?: string
  }) =>
    api.download({
      url: apiRoutes.exportCreditLedger.replace(':orgID', String(orgId ?? '')),
      method: 'get',
      params: {
        format
      }
    })
}

/**
 * Downloads one compliance-period ledger. Separate from useDownloadCreditLedger
 * because it hits the period endpoint, which exports the same April–March
 * envelope the screen shows; the other is for the legacy all-time grid.
 */
export const useDownloadPeriodCreditLedger = (apiOpts?: AxiosRequestConfig) => {
  const api = useApiService(apiOpts)
  return ({
    orgId,
    complianceYear,
    includePending = false,
    format = 'xlsx'
  }: {
    orgId: number | string
    complianceYear: number | string
    includePending?: boolean
    format?: string
  }) =>
    api.download({
      url: apiRoutes.exportCreditLedgerPeriod
        .replace(':orgID', String(orgId ?? ''))
        .replace(':year', String(complianceYear ?? '')),
      method: 'get',
      params: { include_pending: includePending, format }
    })
}

export const useCreditLedgerYears = (
  orgId: number | string | undefined | null,
  options?: QueryOptions<string[]>
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
      const { data } = await api.get<string[]>(url)
      return data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    ...options
  })
}
