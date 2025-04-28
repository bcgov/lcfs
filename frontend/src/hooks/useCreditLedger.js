import { useQuery } from '@tanstack/react-query'
import { useApiService } from '@/services/useApiService'
import { apiRoutes } from '@/constants/routes/apiRoutes'

export const useCreditLedger = (
  {
    orgId,
    page = 1,
    size = 10,
    period,
    sortOrders = [],
    extraFilters = []
  } = {},
  options
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

      const url = apiRoutes.creditLedger.replace(':orgID', orgId)
      const { data } = await api.post(url, body)
      return data
    },
    ...options
  })
}

export const useDownloadCreditLedger = (apiOpts) => {
  const api = useApiService(apiOpts)
  return ({ orgId, complianceYear, format = 'xlsx' }) =>
    api.download(apiRoutes.exportCreditLedger.replace(':orgID', orgId), {
      ...(complianceYear && { compliance_year: complianceYear }),
      format
    })
}
