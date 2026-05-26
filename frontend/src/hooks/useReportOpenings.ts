import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiService } from '@/services/useApiService'
import { apiRoutes } from '@/constants/routes'
import type { QueryOptions, ExtMutationOptions} from './types'

const QUERY_KEY = ['report-openings']

export const useReportOpenings = (options: QueryOptions<unknown> = {}) => {
  const client = useApiService()
  const { enabled = true, staleTime = 5 * 60 * 1000, gcTime = 5 * 60 * 1000, ...rest } = options

  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data } = await client.get(apiRoutes.reportOpenings)
      return data
    },
    enabled,
    staleTime,
    gcTime,
    ...rest
  })
}

export const useUpdateReportOpenings = (options: ExtMutationOptions<unknown, any> = {}) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  const { onSuccess, ...rest } = options

  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await client.put(apiRoutes.reportOpenings, payload)
      return data
    },
    onSuccess: (data, variables, context) => {
      queryClient.setQueryData(QUERY_KEY, data)
      onSuccess?.(data, variables, context)
    },
    ...rest
  })
}
