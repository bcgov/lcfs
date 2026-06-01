import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRoutes } from '@/constants/routes/index'
import type { QueryOptions, ExtMutationOptions} from './types'

// Default cache configuration
const DEFAULT_STALE_TIME = 5 * 60 * 1000 // 5 minutes
const DEFAULT_CACHE_TIME = 10 * 60 * 1000 // 10 minutes

export const useOrganizationSnapshot = (complianceReportId: number | string | undefined | null, options: QueryOptions<unknown> = {}) => {
  const client = useApiService()

  const {
    staleTime = DEFAULT_STALE_TIME,
    gcTime = DEFAULT_CACHE_TIME,
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: ['organization-snapshot', complianceReportId],
    queryFn: async () => {
      if (!complianceReportId) {
        throw new Error('Compliance Report ID is required')
      }
      
      const response = await client.get(
        `${apiRoutes.getOrganizationSnapshot.replace(':reportID', String(complianceReportId ?? ''))}`
      )
      return response.data
    },
    enabled: enabled && !!complianceReportId,
    staleTime,
    gcTime,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...restOptions
  })
}

export const useUpdateOrganizationSnapshot = (reportID: number | string | undefined | null, options: ExtMutationOptions<unknown, any> = {}) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  const path = apiRoutes.getOrganizationSnapshot.replace(':reportID', String(reportID ?? ''))

  const {
    onSuccess,
    onError,
    invalidateRelatedQueries = true,
    clearCache = true,
    ...restOptions
  } = options

  return useMutation({
    mutationFn: async (data: any) => {
      if (!reportID) {
        throw new Error('Report ID is required')
      }
      return await client.put(path, data)
    },
    onSuccess: (data, variables, context) => {
      // Handle cache clearing or invalidation
      if (clearCache) {
        queryClient.removeQueries({ queryKey: ['organization-snapshot', reportID] })
      } else {
        queryClient.setQueryData(['organization-snapshot', reportID], data.data)
      }
      if (invalidateRelatedQueries) {
        queryClient.invalidateQueries({ queryKey: ['organization-snapshot'] })
      }

      // Call custom onSuccess handler if provided
      onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      // Optionally invalidate queries on error to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['organization-snapshot', reportID] })
      
      // Call custom onError handler if provided
      onError?.(error, variables, context)
    },
    ...restOptions
  })
}