import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

// Default cache configuration
const DEFAULT_STALE_TIME = 5 * 60 * 1000 // 5 minutes
const DEFAULT_CACHE_TIME = 10 * 60 * 1000 // 10 minutes
const OPTIONS_STALE_TIME = 60 * 60 * 1000 // 1 hr (options change less frequently)
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
    queryKey: ['chargingSitesByOrg', organizationId, pagination],
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

export const useGetAllChargingSites = (pagination, options = {}) => {
  const client = useApiService()
  const {
    staleTime = DEFAULT_STALE_TIME,
    cacheTime = DEFAULT_CACHE_TIME,
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: ['chargingSitesAll', pagination],
    queryFn: async () => {
      const response = await client.post(apiRoutes.getAllChargingSites, {
        ...pagination
      })
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
          throw new Error('Charging site ID is required for deletion')
        }
        return await client.delete(
          `${apiRoutes.saveChargingSite.replace(':orgID', organizationId)}/${chargingSiteId}`,
          data
        )
      } else if (data.chargingSiteId) {
        // Update operation (has ID and not explicitly creating)
        return await client.put(
          `${apiRoutes.saveChargingSite.replace(':orgID', organizationId)}/${chargingSiteId}`,
          data
        )
      } else {
        // Create operation (no ID or explicitly creating)
        return await client.post(
          apiRoutes.saveChargingSite.replace(':orgID', organizationId),
          data
        )
      }
    },
    onSuccess: (data, variables, context) => {
      // Handle cache invalidation
      if (clearCache) {
        queryClient.removeQueries(['chargingSitesByOrg', organizationId])
      } else {
        queryClient.invalidateQueries({
          predicate: (query) => {
            return (
              query.queryKey[0] === 'chargingSitesByOrg' &&
              query.queryKey[1] === organizationId
            )
          }
        })
      }

      onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      // Always invalidate on error to ensure fresh data on retry
      queryClient.invalidateQueries({
        predicate: (query) => {
          return (
            query.queryKey[0] === 'chargingSitesByOrg' &&
            query.queryKey[1] === organizationId
          )
        }
      })

      onError?.(error, variables, context)
    },
    ...restOptions
  })
}

export const useChargingSite = (siteId) => {
  const apiService = useApiService()

  return useQuery({
    queryKey: ['charging-site', siteId],
    queryFn: () => apiService.get(`/charging-sites/${siteId}`),
    select: (response) => response.data,
    enabled: !!siteId
  })
}

export const useChargingSiteStatuses = () => {
  const apiService = useApiService()

  return useQuery({
    queryKey: ['charging-site-statuses'],
    queryFn: () => apiService.get('/charging-sites/statuses/'),
    select: (response) => response.data,
    staleTime: DEFAULT_STALE_TIME
  })
}

export const useBulkUpdateEquipmentStatus = () => {
  const apiService = useApiService()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ siteId, equipment_ids, new_status }) =>
      apiService.post(
        `/charging-sites/${siteId}/equipment/bulk-status-update`,
        {
          equipment_ids,
          new_status
        }
      ),
    onSuccess: (_, { siteId }) => {
      // Invalidate and refetch charging site data
      queryClient.invalidateQueries({ queryKey: ['charging-site', siteId] })
      queryClient.invalidateQueries({ queryKey: ['charging-sites'] })
      queryClient.invalidateQueries({
        queryKey: ['charging-site-equipment-paginated', siteId]
      })
    },
    onError: (error) => {
      console.error('Failed to bulk update equipment status:', error)
    }
  })
}

export const useChargingSiteEquipmentPaginated = (
  siteId,
  paginationOptions,
  options
) => {
  const apiService = useApiService()

  return useQuery({
    queryKey: ['charging-site-equipment-paginated', siteId, paginationOptions],
    queryFn: async () => {
      const url = apiRoutes.getChargingSiteEquipmentPaginated.replace(
        ':siteId',
        siteId
      )
      const response = await apiService.post(url, paginationOptions)
      return response.data
    },
    enabled: !!siteId,
    ...options
  })
}
