import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryOptions, PaginationParams, ExtMutationOptions} from './types'

// Default cache configuration
const DEFAULT_STALE_TIME = 5 * 60 * 1000 // 5 minutes
const DEFAULT_CACHE_TIME = 10 * 60 * 1000 // 10 minutes
const OPTIONS_STALE_TIME = 30 * 60 * 1000 // 30 minutes (options change less frequently)

export const useFuelExportOptions = (params: Record<string, any>, options: QueryOptions<unknown> = {}) => {
  const client = useApiService()

  const {
    staleTime = OPTIONS_STALE_TIME,
    gcTime = DEFAULT_CACHE_TIME,
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: ['fuel-export-options', params?.compliancePeriod],
    queryFn: async () => {
      if (!params?.compliancePeriod) {
        throw new Error('Compliance period is required')
      }

      const path = `${apiRoutes.fuelExportOptions}compliancePeriod=${params.compliancePeriod}`
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

export const useGetFuelExports = (params: Record<string, any>, pagination: PaginationParams, options: QueryOptions<unknown> = {}) => {
  const client = useApiService()

  const {
    staleTime = DEFAULT_STALE_TIME,
    gcTime = DEFAULT_CACHE_TIME,
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: ['fuel-exports', 'paginated', params, pagination],
    queryFn: async () => {
      if (!params) {
        throw new Error('Parameters are required')
      }

      const requestData = {
        ...(typeof params === 'string' && { complianceReportId: params }),
        ...(typeof params !== 'string' && params),
        ...pagination
      }

      const response = await client.post(
        apiRoutes.getAllFuelExports,
        requestData
      )
      return response.data
    },
    enabled: enabled && !!params,
    staleTime,
    gcTime,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...restOptions
  })
}

export const useGetFuelExportsList = ({ complianceReportId, changelog = false }: any, pagination: PaginationParams, options: QueryOptions<unknown> = {}) => {
  const client = useApiService()

  const {
    staleTime = DEFAULT_STALE_TIME,
    gcTime = DEFAULT_CACHE_TIME,
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: ['fuel-exports-list', complianceReportId, changelog, pagination],
    queryFn: async () => {
      if (!complianceReportId) {
        throw new Error('Compliance report ID is required')
      }

      const response = await client.post(apiRoutes.getAllFuelExports, {
        complianceReportId,
        changelog,
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

export const useSaveFuelExport = (params: Record<string, any>, options: ExtMutationOptions<unknown, any> = {}) => {
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

      const modifiedData = {
        complianceReportId: params.complianceReportId,
        ...data
      }

      return await client.post(apiRoutes.saveFuelExports, modifiedData)
    },
    onSuccess: (data, variables, context) => {
      if (clearCache) {
        // Remove all fuel export related queries for this report
        queryClient.removeQueries({
          predicate: (query) => {
            return (
              (query.queryKey[0] === 'fuel-exports' ||
                query.queryKey[0] === 'fuel-exports-list') &&
              (query.queryKey.includes(params.complianceReportId) ||
                query.queryKey.some((key: any) => key === params.complianceReportId))
            )
          }
        })
      } else {
        // Invalidate all fuel export queries for this report
        queryClient.invalidateQueries({
          predicate: (query) => {
            return (
              (query.queryKey[0] === 'fuel-exports' ||
                query.queryKey[0] === 'fuel-exports-list') &&
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
      // Invalidate on error to ensure fresh data on retry
      queryClient.invalidateQueries({
        predicate: (query) => {
          return (
            (query.queryKey[0] === 'fuel-exports' ||
              query.queryKey[0] === 'fuel-exports-list') &&
            (query.queryKey.includes(params.complianceReportId) ||
              query.queryKey.some((key: any) => key === params.complianceReportId))
          )
        }
      })

      onError?.(error, variables, context)
    },
    ...restOptions
  })
}

export const useUpdateFuelExport = (params: Record<string, any>, options: ExtMutationOptions<unknown, any> = {}) => {
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
        throw new Error('Fuel export ID is required for update')
      }

      const modifiedData = {
        complianceReportId: params.complianceReportId,
        ...data
      }

      return await client.put(
        `${apiRoutes.saveFuelExports}/${data.id}`,
        modifiedData
      )
    },
    onSuccess: (data, variables, context) => {
      if (clearCache) {
        queryClient.removeQueries({
          predicate: (query) => {
            return (
              (query.queryKey[0] === 'fuel-exports' ||
                query.queryKey[0] === 'fuel-exports-list') &&
              (query.queryKey.includes(params.complianceReportId) ||
                query.queryKey.some((key: any) => key === params.complianceReportId))
            )
          }
        })
      } else {
        queryClient.invalidateQueries({
          predicate: (query) => {
            return (
              (query.queryKey[0] === 'fuel-exports' ||
                query.queryKey[0] === 'fuel-exports-list') &&
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
      queryClient.invalidateQueries({
        predicate: (query) => {
          return (
            (query.queryKey[0] === 'fuel-exports' ||
              query.queryKey[0] === 'fuel-exports-list') &&
            (query.queryKey.includes(params.complianceReportId) ||
              query.queryKey.some((key: any) => key === params.complianceReportId))
          )
        }
      })

      onError?.(error, variables, context)
    },
    ...restOptions
  })
}

export const useDeleteFuelExport = (params: Record<string, any>, options: ExtMutationOptions<unknown, any> = {}) => {
  const client = useApiService()
  const queryClient = useQueryClient()

  const {
    onSuccess,
    onError,
    invalidateRelatedQueries = true,
    ...restOptions
  } = options

  return useMutation({
    mutationFn: async (fuelExportId: any) => {
      if (!params?.complianceReportId) {
        throw new Error('Compliance report ID is required')
      }
      if (!fuelExportId) {
        throw new Error('Fuel export ID is required for deletion')
      }

      return await client.delete(`${apiRoutes.saveFuelExports}/${fuelExportId}`)
    },
    onSuccess: (data, variables, context) => {
      // Always invalidate after deletion to ensure removed item is gone from cache
      queryClient.invalidateQueries({
        predicate: (query) => {
          return (
            (query.queryKey[0] === 'fuel-exports' ||
              query.queryKey[0] === 'fuel-exports-list') &&
            (query.queryKey.includes(params.complianceReportId) ||
              query.queryKey.some((key: any) => key === params.complianceReportId))
          )
        }
      })

      if (invalidateRelatedQueries) {
        queryClient.invalidateQueries({ queryKey: [ 'compliance-report-summary', params.complianceReportId ] })
        queryClient.invalidateQueries({ queryKey: [ 'compliance-report', params.complianceReportId ] })
      }

      onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          return (
            (query.queryKey[0] === 'fuel-exports' ||
              query.queryKey[0] === 'fuel-exports-list') &&
            (query.queryKey.includes(params.complianceReportId) ||
              query.queryKey.some((key: any) => key === params.complianceReportId))
          )
        }
      })

      onError?.(error, variables, context)
    },
    ...restOptions
  })
}

export const useImportFuelExports = (complianceReportId: number | string | undefined | null, options: ExtMutationOptions<unknown, any> = {}) => {
  const client = useApiService()
  const queryClient = useQueryClient()

  const {
    onSuccess,
    onError,
    invalidateRelatedQueries = true,
    ...restOptions
  } = options

  return useMutation({
    mutationFn: async ({ file, isOverwrite }: any) => {
      if (!complianceReportId) {
        throw new Error('Compliance report ID is required')
      }
      if (!file) {
        throw new Error('File is required for import')
      }

      const path = (apiRoutes as any).importFuelExports.replace(
        ':reportID',
        complianceReportId
      )

      const formData = new FormData()
      formData.append('file', file)
      formData.append('filename', file.name)
      formData.append('overwrite', isOverwrite)

      return await client.post(path, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
    },
    onSuccess: (data, variables, context) => {
      // Invalidate all fuel export queries for this report
      queryClient.invalidateQueries({
        predicate: (query) => {
          return (
            (query.queryKey[0] === 'fuel-exports' ||
              query.queryKey[0] === 'fuel-exports-list') &&
            (query.queryKey.includes(complianceReportId) ||
              query.queryKey.some((key: any) => key === complianceReportId))
          )
        }
      })

      if (invalidateRelatedQueries) {
        queryClient.invalidateQueries({ queryKey: [ 'compliance-report-summary', complianceReportId ] })
        queryClient.invalidateQueries({ queryKey: ['compliance-report', complianceReportId] })
      }

      onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      onError?.(error, variables, context)
    },
    ...restOptions
  })
}
