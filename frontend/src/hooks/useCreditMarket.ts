import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useQuery } from '@tanstack/react-query'
import type { QueryOptions } from './types'

export type MarketInterval = 'month' | 'quarter' | 'year'

export interface CreditMarketOverview {
  priceIndex: Array<{
    period: string
    vwap: number | null
    volume: number | null
    minPrice: number | null
    maxPrice: number | null
    medianPrice: number | null
  }>
  marketBalance: Array<{
    period: string
    cumulativeBalance: number
    periodNetUnits: number
  }>
  concentration: {
    hhi?: number | null
    top5Share?: number | null
    totalHolders?: number | null
    topHolders?: Array<{ rank: number; name: string; share: number }>
  }
}

export const useCreditMarketOverview = (
  interval: MarketInterval = 'quarter',
  options: QueryOptions<CreditMarketOverview> = {}
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
