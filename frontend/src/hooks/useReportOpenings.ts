import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiService } from '@/services/useApiService'
import { apiRoutes } from '@/constants/routes'
import type { QueryOptions, ExtMutationOptions } from './types'

const QUERY_KEY = ['report-openings']

export interface ReportOpening {
  complianceYear: number
  complianceReportingEnabled: boolean
  earlyIssuanceEnabled: boolean
  createSupplementalEnabled: boolean
}

export const useReportOpenings = (
  options: QueryOptions<ReportOpening[]> = {}
) => {
  const client = useApiService()
  const {
    enabled = true,
    staleTime = 5 * 60 * 1000,
    gcTime = 5 * 60 * 1000,
    ...rest
  } = options

  return useQuery<ReportOpening[]>({
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

export const useUpdateReportOpenings = (
  options: ExtMutationOptions<ReportOpening[], unknown> = {}
) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  const { onSuccess, ...rest } = options

  return useMutation<ReportOpening[], Error, unknown>({
    mutationFn: async (payload: unknown) => {
      const { data } = await client.put<ReportOpening[]>(
        apiRoutes.reportOpenings,
        payload
      )
      return data
    },
    onSuccess: (data, variables, context) => {
      queryClient.setQueryData(QUERY_KEY, data)
      onSuccess?.(data, variables, context)
    },
    ...rest
  })
}
