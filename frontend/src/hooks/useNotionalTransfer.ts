import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryOptions, PaginationParams, ExtMutationOptions} from './types'

// Default cache configuration
const DEFAULT_STALE_TIME = 5 * 60 * 1000 // 5 minutes
const DEFAULT_CACHE_TIME = 10 * 60 * 1000 // 10 minutes
const OPTIONS_STALE_TIME = 30 * 60 * 1000 // 30 minutes (options change less frequently)

export const useNotionalTransferOptions = (_params: Record<string, any>, options: QueryOptions<unknown> = {}) => {
  const client = useApiService()

  const {
    staleTime = OPTIONS_STALE_TIME,
    gcTime = DEFAULT_CACHE_TIME,
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: ['notional-transfer-options'],
    queryFn: async () => {
      const response = await client.get(apiRoutes.notionalTransferOptions)
      return response.data
    },
    enabled,
    staleTime,
    gcTime,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...restOptions
  })
}

export const useGetAllNotionalTransfers = (complianceReportId: number | string | undefined | null, pagination: PaginationParams, options: QueryOptions<unknown> = {}) => {
  const client = useApiService()

  const {
    staleTime = DEFAULT_STALE_TIME,
    gcTime = DEFAULT_CACHE_TIME,
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: [
      'notional-transfers',
      'paginated',
      complianceReportId,
      pagination
    ],
    queryFn: async () => {
      if (!complianceReportId) {
        throw new Error('Compliance report ID is required')
      }

      const response = await client.post(apiRoutes.getAllNotionalTransfers, {
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

export const useGetAllNotionalTransfersList = ({ complianceReportId, changelog = false }: any, options: QueryOptions<unknown> = {}) => {
  const client = useApiService()

  const {
    staleTime = DEFAULT_STALE_TIME,
    gcTime = DEFAULT_CACHE_TIME,
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: ['notional-transfers-list', complianceReportId, changelog],
    queryFn: async () => {
      if (!complianceReportId) {
        throw new Error('Compliance report ID is required')
      }

      const response = await client.post(apiRoutes.getAllNotionalTransfers, {
        complianceReportId,
        changelog
      })
      return response.data.notionalTransfers || response.data
    },
    enabled: enabled && !!complianceReportId,
    staleTime,
    gcTime,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...restOptions
  })
}

export const useGetNotionalTransfers = ({
    page = 1,
    size = 10,
    sortOrders = [],
    filters = [],
    complianceReportId
  }: any = {}, options: QueryOptions<unknown> = {}) => {
  const client = useApiService()

  const {
    staleTime = DEFAULT_STALE_TIME,
    gcTime = DEFAULT_CACHE_TIME,
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: [
      'notional-transfers',
      'filtered',
      { page, size, sortOrders, filters, complianceReportId }
    ],
    queryFn: async () => {
      const response = await client.post(apiRoutes.getNotionalTransfers, {
        page,
        size,
        sortOrders,
        filters,
        complianceReportId
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

export const useSaveNotionalTransfer = (complianceReportId: number | string | undefined | null, options: ExtMutationOptions<unknown, any> = {}) => {
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
      if (!data) {
        throw new Error('Transfer data is required')
      }

      const transferData = {
        complianceReportId,
        ...data
      }

      return await client.post(apiRoutes.saveNotionalTransfer, transferData)
    },
    onSuccess: (data, variables, context) => {
      if (clearCache) {
        // Remove all notional transfer related queries for this report
        queryClient.removeQueries({
          predicate: (query) => {
            return (
              (query.queryKey[0] === 'notional-transfers' ||
                query.queryKey[0] === 'notional-transfers-list') &&
              (query.queryKey.includes(complianceReportId) ||
                query.queryKey.some(
                  (key) =>
                    typeof key === 'object' &&
                    (key as any)?.complianceReportId === complianceReportId
                ))
            )
          }
        })
      } else {
        // Invalidate all notional transfer queries for this report
        queryClient.invalidateQueries({
          predicate: (query) => {
            return (
              (query.queryKey[0] === 'notional-transfers' ||
                query.queryKey[0] === 'notional-transfers-list') &&
              (query.queryKey.includes(complianceReportId) ||
                query.queryKey.some(
                  (key) =>
                    typeof key === 'object' &&
                    (key as any)?.complianceReportId === complianceReportId
                ))
            )
          }
        })
      }

      if (invalidateRelatedQueries) {
        queryClient.invalidateQueries({ queryKey: [ 'compliance-report-summary', complianceReportId ] })
        queryClient.invalidateQueries({ queryKey: ['compliance-report', complianceReportId] })
      }

      onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      // Invalidate on error to ensure fresh data on retry
      queryClient.invalidateQueries({
        predicate: (query) => {
          return (
            (query.queryKey[0] === 'notional-transfers' ||
              query.queryKey[0] === 'notional-transfers-list') &&
            (query.queryKey.includes(complianceReportId) ||
              query.queryKey.some(
                (key) =>
                  typeof key === 'object' &&
                  (key as any)?.complianceReportId === complianceReportId
              ))
          )
        }
      })

      onError?.(error, variables, context)
    },
    ...restOptions
  })
}

export const useUpdateNotionalTransfer = (complianceReportId: number | string | undefined | null, options: ExtMutationOptions<unknown, any> = {}) => {
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
      if (!data?.id) {
        throw new Error('Transfer ID is required for update')
      }
      if (!complianceReportId) {
        throw new Error('Compliance report ID is required')
      }

      const transferData = {
        complianceReportId,
        ...data
      }

      return await client.put(
        `${apiRoutes.saveNotionalTransfer}/${data.id}`,
        transferData
      )
    },
    onSuccess: (data, variables, context) => {
      if (clearCache) {
        queryClient.removeQueries({
          predicate: (query) => {
            return (
              (query.queryKey[0] === 'notional-transfers' ||
                query.queryKey[0] === 'notional-transfers-list') &&
              (query.queryKey.includes(complianceReportId) ||
                query.queryKey.some(
                  (key) =>
                    typeof key === 'object' &&
                    (key as any)?.complianceReportId === complianceReportId
                ))
            )
          }
        })
      } else {
        queryClient.invalidateQueries({
          predicate: (query) => {
            return (
              (query.queryKey[0] === 'notional-transfers' ||
                query.queryKey[0] === 'notional-transfers-list') &&
              (query.queryKey.includes(complianceReportId) ||
                query.queryKey.some(
                  (key) =>
                    typeof key === 'object' &&
                    (key as any)?.complianceReportId === complianceReportId
                ))
            )
          }
        })
      }

      if (invalidateRelatedQueries) {
        queryClient.invalidateQueries({ queryKey: [ 'compliance-report-summary', complianceReportId ] })
        queryClient.invalidateQueries({ queryKey: ['compliance-report', complianceReportId] })
      }

      onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          return (
            (query.queryKey[0] === 'notional-transfers' ||
              query.queryKey[0] === 'notional-transfers-list') &&
            (query.queryKey.includes(complianceReportId) ||
              query.queryKey.some(
                (key) =>
                  typeof key === 'object' &&
                  (key as any)?.complianceReportId === complianceReportId
              ))
          )
        }
      })

      onError?.(error, variables, context)
    },
    ...restOptions
  })
}

export const useDeleteNotionalTransfer = (complianceReportId: number | string | undefined | null, options: ExtMutationOptions<unknown, any> = {}) => {
  const client = useApiService()
  const queryClient = useQueryClient()

  const {
    onSuccess,
    onError,
    invalidateRelatedQueries = true,
    ...restOptions
  } = options

  return useMutation({
    mutationFn: async (transferId: any) => {
      if (!transferId) {
        throw new Error('Transfer ID is required for deletion')
      }
      if (!complianceReportId) {
        throw new Error('Compliance report ID is required')
      }

      return await client.delete(
        `${apiRoutes.saveNotionalTransfer}/${transferId}`
      )
    },
    onSuccess: (data, variables, context) => {
      // Always invalidate after deletion to ensure removed item is gone from cache
      queryClient.invalidateQueries({
        predicate: (query) => {
          return (
            (query.queryKey[0] === 'notional-transfers' ||
              query.queryKey[0] === 'notional-transfers-list') &&
            (query.queryKey.includes(complianceReportId) ||
              query.queryKey.some(
                (key) =>
                  typeof key === 'object' &&
                  (key as any)?.complianceReportId === complianceReportId
              ))
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
      queryClient.invalidateQueries({
        predicate: (query) => {
          return (
            (query.queryKey[0] === 'notional-transfers' ||
              query.queryKey[0] === 'notional-transfers-list') &&
            (query.queryKey.includes(complianceReportId) ||
              query.queryKey.some(
                (key) =>
                  typeof key === 'object' &&
                  (key as any)?.complianceReportId === complianceReportId
              ))
          )
        }
      })

      onError?.(error, variables, context)
    },
    ...restOptions
  })
}

export const useImportNotionalTransfers = (complianceReportId: number | string | undefined | null, options: ExtMutationOptions<unknown, any> = {}) => {
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

      const path = apiRoutes.importNotionalTransfers

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
      // Invalidate all notional transfer queries for this report
      queryClient.invalidateQueries({
        predicate: (query) => {
          return (
            (query.queryKey[0] === 'notional-transfers' ||
              query.queryKey[0] === 'notional-transfers-list') &&
            (query.queryKey.includes(complianceReportId) ||
              query.queryKey.some(
                (key) =>
                  typeof key === 'object' &&
                  (key as any)?.complianceReportId === complianceReportId
              ))
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
