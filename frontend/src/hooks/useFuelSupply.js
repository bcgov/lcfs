import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { REPORT_SCHEDULES_VIEW } from '@/constants/statuses'

// Default cache configuration
const DEFAULT_STALE_TIME = 5 * 60 * 1000 // 5 minutes
const DEFAULT_CACHE_TIME = 10 * 60 * 1000 // 10 minutes
const OPTIONS_STALE_TIME = 30 * 60 * 1000 // 30 minutes (options change less frequently)

export const useFuelSupplyOptions = (params, options = {}) => {
  const client = useApiService()

  const {
    staleTime = OPTIONS_STALE_TIME,
    cacheTime = DEFAULT_CACHE_TIME,
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: ['fuel-supply-options', params?.compliancePeriod],
    queryFn: async () => {
      if (!params?.compliancePeriod) {
        throw new Error('Compliance period is required')
      }

      const path = `${apiRoutes.fuelSupplyOptions}compliancePeriod=${params.compliancePeriod}`
      const response = await client.get(path)
      return response.data
    },
    enabled: enabled && !!params?.compliancePeriod,
    staleTime,
    cacheTime,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...restOptions
  })
}

export const useGetFuelSupplies = (
  complianceReportId,
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
    queryKey: ['fuel-supplies', complianceReportId, 'paginated', pagination],
    queryFn: async () => {
      if (!complianceReportId) {
        throw new Error('Compliance report ID is required')
      }

      const response = await client.post(apiRoutes.getAllFuelSupplies, {
        complianceReportId,
        ...pagination
      })
      return response.data
    },
    enabled: enabled && !!complianceReportId,
    staleTime,
    cacheTime,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...restOptions
  })
}

export const useGetFuelSuppliesList = (
  { complianceReportId, mode = REPORT_SCHEDULES_VIEW.VIEW },
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
    queryKey: ['fuel-supplies-list', complianceReportId, mode, pagination],
    queryFn: async () => {
      if (!complianceReportId) {
        throw new Error('Compliance report ID is required')
      }

      const response = await client.post(apiRoutes.getAllFuelSupplies, {
        complianceReportId,
        mode,
        ...pagination
      })
      return response.data
    },
    enabled: enabled && !!complianceReportId,
    staleTime,
    cacheTime,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...restOptions
  })
}

export const useSaveFuelSupply = (params, options = {}) => {
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
      if (!params?.complianceReportId) {
        throw new Error('Compliance report ID is required')
      }

      const modifiedData = {
        complianceReportId: params.complianceReportId,
        ...data
      }

      return await client.post(apiRoutes.saveFuelSupplies, modifiedData)
    },
    onSuccess: (data, variables, context) => {
      if (clearCache) {
        // Remove all fuel supplies related to this report
        queryClient.removeQueries({
          predicate: (query) => {
            return (
              (query.queryKey[0] === 'fuel-supplies' ||
                query.queryKey[0] === 'fuel-supplies-list') &&
              (query.queryKey.includes(params.complianceReportId) ||
                query.queryKey.some((key) => key === params.complianceReportId))
            )
          }
        })
      } else {
        // Invalidate all fuel supply queries for this report
        queryClient.invalidateQueries({
          predicate: (query) => {
            return (
              (query.queryKey[0] === 'fuel-supplies' ||
                query.queryKey[0] === 'fuel-supplies-list') &&
              (query.queryKey.includes(params.complianceReportId) ||
                query.queryKey.some((key) => key === params.complianceReportId))
            )
          }
        })
      }

      if (invalidateRelatedQueries) {
        // Invalidate related queries that depend on fuel supply data
        queryClient.invalidateQueries([
          'compliance-report-summary',
          params.complianceReportId
        ])
        queryClient.invalidateQueries([
          'compliance-report',
          params.complianceReportId
        ])
      }

      onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      // Invalidate on error to ensure fresh data on retry
      queryClient.invalidateQueries([
        'fuel-supplies',
        params.complianceReportId
      ])
      queryClient.invalidateQueries([
        'fuel-supplies-list',
        params.complianceReportId
      ])

      onError?.(error, variables, context)
    },
    ...restOptions
  })
}

export const useUpdateFuelSupply = (params, options = {}) => {
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
      if (!params?.complianceReportId) {
        throw new Error('Compliance report ID is required')
      }
      if (!data?.id) {
        throw new Error('Fuel supply ID is required for update')
      }

      const modifiedData = {
        complianceReportId: params.complianceReportId,
        ...data
      }

      return await client.put(
        `${apiRoutes.saveFuelSupplies}/${data.id}`,
        modifiedData
      )
    },
    onSuccess: (data, variables, context) => {
      if (clearCache) {
        queryClient.removeQueries(['fuel-supplies', params.complianceReportId])
        queryClient.removeQueries([
          'fuel-supplies-list',
          params.complianceReportId
        ])
      } else {
        // Invalidate all fuel supply queries for this report (same method as FuelExports)
        queryClient.invalidateQueries({
          predicate: (query) => {
            return (
              (query.queryKey[0] === 'fuel-supplies' ||
                query.queryKey[0] === 'fuel-supplies-list') &&
              (query.queryKey.includes(params.complianceReportId) ||
                query.queryKey.some((key) => key === params.complianceReportId))
            )
          }
        })
      }

      if (invalidateRelatedQueries) {
        queryClient.invalidateQueries([
          'compliance-report-summary',
          params.complianceReportId
        ])
        queryClient.invalidateQueries([
          'compliance-report',
          params.complianceReportId
        ])
      }

      onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      queryClient.invalidateQueries([
        'fuel-supplies',
        params.complianceReportId
      ])
      queryClient.invalidateQueries([
        'fuel-supplies-list',
        params.complianceReportId
      ])

      onError?.(error, variables, context)
    },
    ...restOptions
  })
}

export const useDeleteFuelSupply = (params, options = {}) => {
  const client = useApiService()
  const queryClient = useQueryClient()

  const {
    onSuccess,
    onError,
    invalidateRelatedQueries = true,
    ...restOptions
  } = options

  return useMutation({
    mutationFn: async (fuelSupplyId) => {
      if (!params?.complianceReportId) {
        throw new Error('Compliance report ID is required')
      }
      if (!fuelSupplyId) {
        throw new Error('Fuel supply ID is required for deletion')
      }

      return await client.delete(
        `${apiRoutes.saveFuelSupplies}/${fuelSupplyId}`
      )
    },
    onSuccess: (data, variables, context) => {
      // Always invalidate after deletion to ensure removed item is gone from cache
      queryClient.invalidateQueries([
        'fuel-supplies',
        params.complianceReportId
      ])
      queryClient.invalidateQueries([
        'fuel-supplies-list',
        params.complianceReportId
      ])

      if (invalidateRelatedQueries) {
        queryClient.invalidateQueries([
          'compliance-report-summary',
          params.complianceReportId
        ])
        queryClient.invalidateQueries([
          'compliance-report',
          params.complianceReportId
        ])
      }

      onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      queryClient.invalidateQueries([
        'fuel-supplies',
        params.complianceReportId
      ])
      queryClient.invalidateQueries([
        'fuel-supplies-list',
        params.complianceReportId
      ])

      onError?.(error, variables, context)
    },
    ...restOptions
  })
}

export const useOrganizationFuelSupply = (organizationId, pagination, options = {}) => {
  const client = useApiService()

  const {
    staleTime = DEFAULT_STALE_TIME,
    cacheTime = DEFAULT_CACHE_TIME,
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: ['organization-fuel-supply', organizationId, pagination],
    queryFn: async () => {
      if (!organizationId) {
        throw new Error('Organization ID is required')
      }

      const path = apiRoutes.getOrganizationFuelSupply.replace(
        ':orgID',
        organizationId
      )
      const response = await client.post(path, pagination)
      return response.data
    },
    enabled: enabled && !!organizationId,
    staleTime,
    cacheTime,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...restOptions
  })
}
