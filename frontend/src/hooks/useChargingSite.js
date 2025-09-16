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

export const useGetChargingSiteById = (chargingSiteId, options = {}) => {
  const client = useApiService()
  const {
    staleTime = DEFAULT_STALE_TIME,
    cacheTime = DEFAULT_CACHE_TIME,
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: ['chargingSite', chargingSiteId],
    queryFn: async () => {
      const response = await client.get(
        apiRoutes.getChargingSite.replace(':chargingSiteId', chargingSiteId)
      )
      return response.data
    },
    staleTime,
    cacheTime,
    enabled: enabled && !!chargingSiteId,
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
      // Comprehensive cache invalidation for charging site mutations
      if (clearCache) {
        // Remove all charging site related queries
        queryClient.removeQueries({ queryKey: ['chargingSitesByOrg'] })
        queryClient.removeQueries({ queryKey: ['chargingSite'] })
        queryClient.removeQueries({
          queryKey: ['charging-site-equipment-paginated']
        })
      } else {
        // Invalidate all related queries
        queryClient.invalidateQueries({ queryKey: ['chargingSitesByOrg'] })
        queryClient.invalidateQueries({ queryKey: ['chargingSite'] })
        queryClient.invalidateQueries({
          queryKey: ['charging-site-equipment-paginated']
        })

        // Also invalidate any specific charging site queries
        if (variables.chargingSiteId) {
          queryClient.invalidateQueries({
            queryKey: ['chargingSite', variables.chargingSiteId]
          })
          queryClient.invalidateQueries({
            queryKey: [
              'charging-site-equipment-paginated',
              variables.chargingSiteId
            ]
          })
        }
      }

      onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      // Always invalidate on error to ensure fresh data on retry
      queryClient.invalidateQueries({ queryKey: ['chargingSitesByOrg'] })
      queryClient.invalidateQueries({ queryKey: ['chargingSite'] })
      queryClient.invalidateQueries({
        queryKey: ['charging-site-equipment-paginated']
      })

      onError?.(error, variables, context)
    },
    ...restOptions
  })
}

export const useChargingSiteStatuses = () => {
  const apiService = useApiService()

  return useQuery({
    queryKey: ['charging-site-statuses'],
    queryFn: () => apiService.get('/charging-sites/statuses/'),
    select: (response) => response.data,
    staleTime: 60 * 60 * 1000 // 60 minutes
  })
}

export const useBulkUpdateEquipmentStatus = (options = {}) => {
  const apiService = useApiService()
  const queryClient = useQueryClient()

  const { onSuccess, onError, invalidateAll = true, ...restOptions } = options

  return useMutation({
    mutationFn: ({ chargingSiteId, equipment_ids, new_status }) => {
      // Validate chargingSiteId before making the API call
      if (!chargingSiteId || chargingSiteId === 'undefined') {
        throw new Error('Invalid charging site ID provided')
      }

      return apiService.post(
        `/charging-sites/${chargingSiteId}/equipment/bulk-status-update`,
        {
          equipment_ids,
          new_status
        }
      )
    },
    onSuccess: (data, variables, context) => {
      const { chargingSiteId } = variables

      if (invalidateAll) {
        // Comprehensive cache invalidation - invalidate all related queries

        // 1. Invalidate specific charging site queries
        queryClient.invalidateQueries({
          queryKey: ['chargingSite', chargingSiteId]
        })

        // 2. Invalidate equipment pagination queries for this site
        queryClient.invalidateQueries({
          queryKey: ['charging-site-equipment-paginated', chargingSiteId]
        })

        // 3. Invalidate all charging sites by organization queries
        queryClient.invalidateQueries({
          queryKey: ['chargingSitesByOrg']
        })

        // 4. Invalidate any general charging sites queries
        queryClient.invalidateQueries({
          queryKey: ['chargingSite']
        })

        // 5. Invalidate all equipment-related queries
        queryClient.invalidateQueries({
          queryKey: ['charging-site-equipment-paginated']
        })

        // 6. Invalidate charging site statuses (in case status counts changed)
        queryClient.invalidateQueries({
          queryKey: ['charging-site-statuses']
        })

        // 7. Invalidate any dashboard or summary queries that might show equipment counts
        queryClient.invalidateQueries({
          predicate: (query) => {
            return query.queryKey.some(
              (key) =>
                typeof key === 'string' &&
                (key.includes('dashboard') ||
                  key.includes('summary') ||
                  key.includes('equipment') ||
                  key.includes('charging-site'))
            )
          }
        })
      } else {
        // Minimal invalidation - just the specific queries
        queryClient.invalidateQueries({
          queryKey: ['chargingSite', chargingSiteId]
        })
        queryClient.invalidateQueries({
          queryKey: ['charging-site-equipment-paginated', chargingSiteId]
        })
      }

      // Call custom success handler
      onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      console.error('Failed to bulk update equipment status:', error)

      // On error, invalidate queries to ensure we have fresh data
      const { chargingSiteId } = variables || {}

      if (chargingSiteId && chargingSiteId !== 'undefined') {
        queryClient.invalidateQueries({
          queryKey: ['chargingSite', chargingSiteId]
        })
        queryClient.invalidateQueries({
          queryKey: ['charging-site-equipment-paginated', chargingSiteId]
        })
      }

      // Call custom error handler
      onError?.(error, variables, context)
    },
    // Add retry logic for network failures
    retry: (failureCount, error) => {
      // Don't retry validation errors (400-level)
      if (error?.response?.status >= 400 && error?.response?.status < 500) {
        return false
      }
      // Retry up to 3 times for server errors
      return failureCount < 3
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    ...restOptions
  })
}

export const useChargingSiteEquipmentPaginated = (
  siteId,
  paginationOptions,
  options = {}
) => {
  const apiService = useApiService()

  return useQuery({
    queryKey: ['charging-site-equipment-paginated', siteId, paginationOptions],
    queryFn: async () => {
      // Validate siteId before making the API call
      if (!siteId || siteId === 'undefined') {
        throw new Error('Invalid site ID provided')
      }

      const url = apiRoutes.getChargingSiteEquipmentPaginated.replace(
        ':siteId',
        siteId
      )
      const response = await apiService.post(url, paginationOptions)
      return response.data
    },
    enabled: !!siteId && siteId !== 'undefined',
    staleTime: 30000, // 30 seconds
    retry: (failureCount, error) => {
      // Don't retry if it's a validation error about invalid site ID
      if (
        error?.message?.includes('Invalid site ID') ||
        error?.response?.status === 400
      ) {
        return false
      }
      return failureCount < 3
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    ...options
  })
}

// Helper function to invalidate all charging site related queries
export const useInvalidateChargingSiteQueries = () => {
  const queryClient = useQueryClient()

  return {
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: ['chargingSite'] })
      queryClient.invalidateQueries({ queryKey: ['chargingSitesByOrg'] })
      queryClient.invalidateQueries({
        queryKey: ['charging-site-equipment-paginated']
      })
      queryClient.invalidateQueries({ queryKey: ['charging-site-statuses'] })
    },
    invalidateForSite: (siteId) => {
      queryClient.invalidateQueries({ queryKey: ['chargingSite', siteId] })
      queryClient.invalidateQueries({
        queryKey: ['charging-site-equipment-paginated', siteId]
      })
    },
    invalidateForOrganization: (orgId) => {
      queryClient.invalidateQueries({ queryKey: ['chargingSitesByOrg', orgId] })
    }
  }
}
