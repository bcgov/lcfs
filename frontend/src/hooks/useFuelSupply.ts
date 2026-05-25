import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { REPORT_SCHEDULES_VIEW } from '@/constants/statuses'
import type { QueryOptions, PaginationParams, ExtMutationOptions} from './types'

// Default cache configuration
const DEFAULT_STALE_TIME = 5 * 60 * 1000 // 5 minutes
const DEFAULT_CACHE_TIME = 10 * 60 * 1000 // 10 minutes
const OPTIONS_STALE_TIME = 30 * 60 * 1000 // 30 minutes (options change less frequently)

export const useFuelSupplyOptions = (params: Record<string, any>, options: QueryOptions<unknown> = {}) => {
  const client = useApiService()

  const {
    staleTime = OPTIONS_STALE_TIME,
    gcTime = DEFAULT_CACHE_TIME,
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
    gcTime,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...restOptions
  })
}

export const useGetFuelSupplies = (complianceReportId: number | string | undefined | null, pagination: PaginationParams, options: QueryOptions<unknown> = {}) => {
  const client = useApiService()

  const {
    staleTime = DEFAULT_STALE_TIME,
    gcTime = DEFAULT_CACHE_TIME,
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
    gcTime,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...restOptions
  })
}

export const useGetFuelSuppliesList = ({ complianceReportId, mode = REPORT_SCHEDULES_VIEW.VIEW }: any, pagination: PaginationParams, options: QueryOptions<unknown> = {}) => {
  const client = useApiService()

  const {
    staleTime = DEFAULT_STALE_TIME,
    gcTime = DEFAULT_CACHE_TIME,
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
    gcTime,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...restOptions
  })
}

export const useSaveFuelSupply = (params: Record<string, any>, options: ExtMutationOptions<unknown, any> = {}) => {
  const client = useApiService()
  const queryClient = useQueryClient()

  const {
    onSuccess,
    onError,
    invalidateRelatedQueries = true,
    clearCache = false,
    invalidateListQuery = true,
    ...restOptions
  } = options

  return useMutation({
    mutationFn: async (data: any) => {
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
      const matchesReport = (query: any) =>
        query.queryKey.includes(params.complianceReportId) ||
        query.queryKey.some((key: any) => key === params.complianceReportId)

      const queryKeyMatches = (query: any) => {
        const key = query.queryKey[0]
        if (key === 'fuel-supplies') return true
        if (key === 'fuel-supplies-list') return invalidateListQuery
        return false
      }

      if (clearCache) {
        queryClient.removeQueries({
          predicate: (query: any) =>
            queryKeyMatches(query) && matchesReport(query)
        })
      } else {
        queryClient.invalidateQueries({
          predicate: (query: any) =>
            queryKeyMatches(query) && matchesReport(query)
        })
      }

      if (invalidateRelatedQueries) {
        queryClient.invalidateQueries({ queryKey: [ 'compliance-report-summary', params.complianceReportId ] })
        queryClient.invalidateQueries({ queryKey: [ 'compliance-report', params.complianceReportId ] })
      }

      onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      // Invalidate on error to ensure fresh data on retry
      queryClient.invalidateQueries({ queryKey: [ 'fuel-supplies', params.complianceReportId ] })
      queryClient.invalidateQueries({ queryKey: [ 'fuel-supplies-list', params.complianceReportId ] })

      onError?.(error, variables, context)
    },
    ...restOptions
  })
}

export const useUpdateFuelSupply = (params: Record<string, any>, options: ExtMutationOptions<unknown, any> = {}) => {
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
    mutationFn: async (data: any) => {
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
        queryClient.removeQueries({ queryKey: ['fuel-supplies', params.complianceReportId] })
        queryClient.removeQueries({ queryKey: [ 'fuel-supplies-list', params.complianceReportId ] })
      } else {
        // Invalidate all fuel supply queries for this report (same method as FuelExports)
        queryClient.invalidateQueries({
          predicate: (query: any) => {
            return (
              (query.queryKey[0] === 'fuel-supplies' ||
                query.queryKey[0] === 'fuel-supplies-list') &&
              (query.queryKey.includes(params.complianceReportId) ||
                query.queryKey.some((key: any) => key === params.complianceReportId))
            )
          }
        })
      }

      if (invalidateRelatedQueries) {
        queryClient.invalidateQueries({ queryKey: [ 'compliance-report-summary', params.complianceReportId ] })
        queryClient.invalidateQueries({ queryKey: [ 'compliance-report', params.complianceReportId ] })
      }

      onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      queryClient.invalidateQueries({ queryKey: [ 'fuel-supplies', params.complianceReportId ] })
      queryClient.invalidateQueries({ queryKey: [ 'fuel-supplies-list', params.complianceReportId ] })

      onError?.(error, variables, context)
    },
    ...restOptions
  })
}

export const useDeleteFuelSupply = (params: Record<string, any>, options: ExtMutationOptions<unknown, any> = {}) => {
  const client = useApiService()
  const queryClient = useQueryClient()

  const {
    onSuccess,
    onError,
    invalidateRelatedQueries = true,
    ...restOptions
  } = options

  return useMutation({
    mutationFn: async (fuelSupplyId: any) => {
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
      queryClient.invalidateQueries({ queryKey: [ 'fuel-supplies', params.complianceReportId ] })
      queryClient.invalidateQueries({ queryKey: [ 'fuel-supplies-list', params.complianceReportId ] })

      if (invalidateRelatedQueries) {
        queryClient.invalidateQueries({ queryKey: [ 'compliance-report-summary', params.complianceReportId ] })
        queryClient.invalidateQueries({ queryKey: [ 'compliance-report', params.complianceReportId ] })
      }

      onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      queryClient.invalidateQueries({ queryKey: [ 'fuel-supplies', params.complianceReportId ] })
      queryClient.invalidateQueries({ queryKey: [ 'fuel-supplies-list', params.complianceReportId ] })

      onError?.(error, variables, context)
    },
    ...restOptions
  })
}

export const useOrganizationFuelSupply = (organizationId: number | string | undefined | null, pagination: PaginationParams, options: QueryOptions<unknown> = {}) => {
  const client = useApiService()

  const {
    staleTime = DEFAULT_STALE_TIME,
    gcTime = DEFAULT_CACHE_TIME,
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: ['organization-fuel-supply', organizationId, pagination],
    queryFn: async () => {
      if (!organizationId) {
        throw new Error('Organization ID is required')
      }

      const path = apiRoutes.getOrganizationFuelSupply.replace(':orgID', String(organizationId ?? ''))
      const response = await client.post(path, pagination)
      return response.data
    },
    enabled: enabled && !!organizationId,
    staleTime,
    gcTime,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...restOptions
  })
}
