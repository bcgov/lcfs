import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useQuery } from '@tanstack/react-query'

// Default cache configuration
const DEFAULT_STALE_TIME = 5 * 60 * 1000 // 5 minutes
const DEFAULT_CACHE_TIME = 10 * 60 * 1000 // 10 minutes
const OPTIONS_STALE_TIME = 30 * 60 * 1000 // 30 minutes (options change less frequently)
const JOB_STATUS_STALE_TIME = 0 // Real-time for job status

export const useGetIntendedUsers = (options = {}) => {
  const client = useApiService()
  const {
    staleTime = OPTIONS_STALE_TIME,
    cacheTime = DEFAULT_CACHE_TIME,
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: ['intendedUsers'],
    queryFn: async () => {
      const response = await client.get(apiRoutes.intendedUsers)
      return response.data
    },
    staleTime,
    cacheTime,
    enabled,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...restOptions
  })
}

export const useGetAllChargingSitesByOrg = (
  organizationId,
  pagination,
  options = {}
) => {
  const client = useApiService()
  const {
    staleTime = DEFAULT_STALE_TIME,
    cacheTime = DEFAULT_CACHE_TIME,
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: ['chargingSitesByOrg'],
    queryFn: async () => {
      const response = await client.post(
        apiRoutes.getAllChargingSitesByOrg.replace(':orgID', organizationId),
        { pagination }
      )
      return response.data
    },
    staleTime,
    cacheTime,
    enabled: enabled && !!organizationId,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...restOptions
  })
}

export const useChargingSiteMutation = (organizationId, options = {}) => {
  const client = useApiService()
  const queryClient = useQueryClient()

  const {
    onSuccess,
    onError,
    invalidateRelatedQueries = true,
    clearCache = false,
    ...restOptions
  } = options

  return useMutation({
    mutationFn: async (data) => {
      if (!organizationId) {
        throw new Error('Organization ID is required')
      }
      const chargingSiteId = data.chargingSiteId || null
      // Determine operation type
      if (data.deleted) {
        // Delete operation
        if (!chargingSiteId) {
          throw new Error('Equipment ID is required for deletion')
        }
        return await client.delete(
          `${apiRoutes.saveChargingSite}/${chargingSiteId}`
        )
      } else if (data.chargingSiteId) {
        // Update operation (has ID and not explicitly creating)
        const modifiedData = {
          ...data,
          levelOfEquipment:
            data.levelOfEquipment?.name || data.levelOfEquipment,
          complianceReportId
        }
        return await client.put(
          `${apiRoutes.saveChargingSite}/${chargingSiteId}`,
          modifiedData
        )
      } else {
        // Create operation (no ID or explicitly creating)
        const modifiedData = {
          ...data,
          levelOfEquipment:
            data.levelOfEquipment?.name || data.levelOfEquipment,
          complianceReportId
        }
        return await client.post(apiRoutes.saveChargingSite, modifiedData)
      }
    },
    onSuccess: (data, variables, context) => {
      // Handle cache invalidation
      if (clearCache) {
        queryClient.removeQueries([
          'final-supply-equipments',
          complianceReportId
        ])
      } else {
        queryClient.invalidateQueries({
          predicate: (query) => {
            return (
              query.queryKey[0] === 'final-supply-equipments' &&
              query.queryKey[1] === complianceReportId
            )
          }
        })
      }

      // Invalidate related queries if requested
      if (invalidateRelatedQueries) {
        queryClient.invalidateQueries([
          'compliance-report-summary',
          complianceReportId
        ])
        queryClient.invalidateQueries(['compliance-report', complianceReportId])
      }

      onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      // Always invalidate on error to ensure fresh data on retry
      queryClient.invalidateQueries({
        predicate: (query) => {
          return (
            query.queryKey[0] === 'final-supply-equipments' &&
            query.queryKey[1] === complianceReportId
          )
        }
      })

      onError?.(error, variables, context)
    },
    ...restOptions
  })
}
