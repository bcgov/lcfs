import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useApiService } from '@/services/useApiService'

export interface SearchResultItem {
  entityType: string
  entityId: number
  title: string
  subtitle: string
  route: string
  status?: string | null
  meta?: string | null
  matchContext?: string | null
  details?: Array<{ label: string; value: string }>
}

export interface SearchGroup {
  entityType: string
  label: string
  items: SearchResultItem[]
}

export interface SearchResponse {
  query: string
  groups: SearchGroup[]
  total: number
  appliedFilters?: Record<string, string>
}

export const useGlobalSearch = (q: string) => {
  const client = useApiService()

  return useQuery<SearchResponse>({
    queryKey: ['global-search', q],
    queryFn: async () => {
      const response = await client.get(`/search/?q=${encodeURIComponent(q)}`)
      return response.data
    },
    enabled: q.trim().length >= 2,
    staleTime: 30_000,
    placeholderData: keepPreviousData
  })
}
