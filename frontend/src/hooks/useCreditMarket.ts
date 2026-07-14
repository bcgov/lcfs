import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useQuery } from '@tanstack/react-query'
import type { QueryOptions } from './types'

export type MarketInterval = 'month' | 'quarter' | 'year'

export const useCreditMarketOverview = (
  interval: MarketInterval = 'quarter',
  options: QueryOptions<unknown> = {}
) => {
  const client = useApiService()
  const path = apiRoutes.creditMarketOverview

  return useQuery({
    queryKey: ['credit-market-overview', interval],
    queryFn: async () => {
      const response = await client.get(path, { params: { interval } })
      return response.data
    },
    ...options
  })
}

export const useCreditMarketPublicOverview = (
  interval: MarketInterval = 'quarter',
  options: QueryOptions<unknown> = {}
) => {
  const client = useApiService()
  const path = apiRoutes.creditMarketPublicOverview

  return useQuery({
    queryKey: ['credit-market-public-overview', interval],
    queryFn: async () => {
      const response = await client.get(path, { params: { interval } })
      return response.data
    },
    ...options
  })
}

export const useCreditMarketPublicReport = (
  options: QueryOptions<unknown> = {}
) => {
  const client = useApiService()
  const path = apiRoutes.creditMarketPublicReport

  return useQuery({
    queryKey: ['credit-market-public-report'],
    queryFn: async () => {
      const response = await client.get(path)
      return response.data
    },
    ...options
  })
}
