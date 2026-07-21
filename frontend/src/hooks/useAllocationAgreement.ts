import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invalidateComplianceReportRelatedQueries } from './reportQueryInvalidation'
import type {
  QueryOptions,
  PaginationParams,
  ExtMutationOptions
} from './types'

// Default cache configuration
const DEFAULT_STALE_TIME = 5 * 60 * 1000 // 5 minutes
const DEFAULT_CACHE_TIME = 10 * 60 * 1000 // 10 minutes
const OPTIONS_STALE_TIME = 30 * 60 * 1000 // 30 minutes (options change less frequently)
const JOB_STATUS_STALE_TIME = 0 // Real-time for job status

export const useAllocationAgreementOptions = (
  params: Record<string, any>,
  options: QueryOptions<unknown> = {}
) => {
  const client = useApiService()

  const {
    staleTime = OPTIONS_STALE_TIME,
    gcTime = DEFAULT_CACHE_TIME,
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: ['allocation-agreement-options', params?.compliancePeriod],
    queryFn: async () => {
      if (!params?.compliancePeriod) {
        throw new Error('Compliance period is required')
      }

      const path = `${apiRoutes.allocationAgreementOptions}compliancePeriod=${params.compliancePeriod}`
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

export const useGetAllocationAgreements = (
  complianceReportId: number | string | undefined | null,
  pagination: PaginationParams,
  options: QueryOptions<unknown> = {}
) => {
  const client = useApiService()

  const {
    staleTime = DEFAULT_STALE_TIME,
    gcTime = DEFAULT_CACHE_TIME,
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: [
      'allocation-agreements',
      'basic',
      complianceReportId,
      pagination
    ],
    queryFn: async () => {
      if (!complianceReportId) {
        throw new Error('Compliance report ID is required')
      }

      const response = await client.post(apiRoutes.getAllocationAgreements, {
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

export const useGetAllAllocationAgreements = (
  complianceReportId: number | string | undefined | null,
  pagination: PaginationParams,
  options: QueryOptions<unknown> = {}
) => {
  const client = useApiService()

  const {
    staleTime = DEFAULT_STALE_TIME,
    gcTime = DEFAULT_CACHE_TIME,
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: ['allocation-agreements', 'all', complianceReportId, pagination],
    queryFn: async () => {
      if (!complianceReportId) {
        throw new Error('Compliance report ID is required')
      }

      const response = await client.post(apiRoutes.getAllAllocationAgreements, {
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

export const useGetAllocationAgreementsList = (
  { complianceReportId, changelog = false }: any,
  pagination: PaginationParams,
  options: QueryOptions<unknown> = {}
) => {
  const client = useApiService()

  const {
    staleTime = DEFAULT_STALE_TIME,
    gcTime = DEFAULT_CACHE_TIME,
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: [
      'allocation-agreements',
      'list',
      complianceReportId,
      changelog,
      pagination
    ],
    queryFn: async () => {
      if (!complianceReportId) {
        throw new Error('Compliance report ID is required')
      }

      const response = await client.post(apiRoutes.getAllAllocationAgreements, {
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

export const useSaveAllocationAgreement = (
  params: Record<string, any>,
  options: ExtMutationOptions<unknown, any> = {}
) => {
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
      if (!data) {
        throw new Error('Allocation agreement data is required')
      }

      const modifiedData = {
        complianceReportId: params.complianceReportId,
        ...data
      }

      return await client.post(apiRoutes.saveAllocationAgreements, modifiedData)
    },
    onSuccess: (data, variables, context) => {
      if (clearCache) {
        // Remove all allocation agreement related queries for this report
        queryClient.removeQueries({
          predicate: (query) => {
            return (
              query.queryKey[0] === 'allocation-agreements' &&
              query.queryKey.includes(params.complianceReportId)
            )
          }
        })
      } else {
        // Invalidate all allocation agreement queries for this report
        queryClient.invalidateQueries({
          predicate: (query) => {
            return (
              query.queryKey[0] === 'allocation-agreements' &&
              query.queryKey.includes(params.complianceReportId)
            )
          }
        })
      }

      if (invalidateRelatedQueries) {
        invalidateComplianceReportRelatedQueries(
          queryClient,
          params.complianceReportId
        )
        // Invalidate allocation organizations cache so charging site field updates
        queryClient.invalidateQueries({ queryKey: ['allocationOrganizations'] })
      }

      onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      // Invalidate on error to ensure fresh data on retry
      queryClient.invalidateQueries({
        predicate: (query) => {
          return (
            query.queryKey[0] === 'allocation-agreements' &&
            query.queryKey.includes(params.complianceReportId)
          )
        }
      })

      onError?.(error, variables, context)
    },
    ...restOptions
  })
}

export const useUpdateAllocationAgreement = (
  params: Record<string, any>,
  options: ExtMutationOptions<unknown, any> = {}
) => {
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
        throw new Error('Allocation agreement ID is required for update')
      }

      const modifiedData = {
        complianceReportId: params.complianceReportId,
        ...data
      }

      return await client.put(
        `${apiRoutes.saveAllocationAgreements}/${data.id}`,
        modifiedData
      )
    },
    onSuccess: (data, variables, context) => {
      if (clearCache) {
        queryClient.removeQueries({
          predicate: (query) => {
            return (
              query.queryKey[0] === 'allocation-agreements' &&
              query.queryKey.includes(params.complianceReportId)
            )
          }
        })
      } else {
        queryClient.invalidateQueries({
          predicate: (query) => {
            return (
              query.queryKey[0] === 'allocation-agreements' &&
              query.queryKey.includes(params.complianceReportId)
            )
          }
        })
      }

      if (invalidateRelatedQueries) {
        invalidateComplianceReportRelatedQueries(
          queryClient,
          params.complianceReportId
        )
        // Invalidate allocation organizations cache so charging site field updates
        queryClient.invalidateQueries({ queryKey: ['allocationOrganizations'] })
      }

      onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          return (
            query.queryKey[0] === 'allocation-agreements' &&
            query.queryKey.includes(params.complianceReportId)
          )
        }
      })

      onError?.(error, variables, context)
    },
    ...restOptions
  })
}

export const useDeleteAllocationAgreement = (
  params: Record<string, any>,
  options: ExtMutationOptions<unknown, any> = {}
) => {
  const client = useApiService()
  const queryClient = useQueryClient()

  const {
    onSuccess,
    onError,
    invalidateRelatedQueries = true,
    ...restOptions
  } = options

  return useMutation({
    mutationFn: async (agreementId: any) => {
      if (!params?.complianceReportId) {
        throw new Error('Compliance report ID is required')
      }
      if (!agreementId) {
        throw new Error('Allocation agreement ID is required for deletion')
      }

      return await client.delete(
        `${apiRoutes.saveAllocationAgreements}/${agreementId}`
      )
    },
    onSuccess: (data, variables, context) => {
      // Always invalidate after deletion to ensure removed item is gone from cache
      queryClient.invalidateQueries({
        predicate: (query) => {
          return (
            query.queryKey[0] === 'allocation-agreements' &&
            query.queryKey.includes(params.complianceReportId)
          )
        }
      })

      if (invalidateRelatedQueries) {
        invalidateComplianceReportRelatedQueries(
          queryClient,
          params.complianceReportId
        )
        // Invalidate allocation organizations cache so charging site field updates
        queryClient.invalidateQueries({ queryKey: ['allocationOrganizations'] })
      }

      onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          return (
            query.queryKey[0] === 'allocation-agreements' &&
            query.queryKey.includes(params.complianceReportId)
          )
        }
      })

      onError?.(error, variables, context)
    },
    ...restOptions
  })
}

export const useImportAllocationAgreement = (
  complianceReportId: number | string | undefined | null,
  options: ExtMutationOptions<unknown, any> = {}
) => {
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

      const path = apiRoutes.importAllocationAgreements.replace(
        ':reportID',
        String(complianceReportId ?? '')
      )

      const formData = new FormData()
      formData.append('file', file)
      formData.append('filename', file.name)
      formData.append('overwrite', isOverwrite)

      return await client.post(path, formData, {
        headers: {
          accept: 'application/json',
          'Content-Type': 'multipart/form-data'
        }
      })
    },
    onSuccess: (data, variables, context) => {
      // Invalidate all allocation agreement queries for this report
      queryClient.invalidateQueries({
        predicate: (query) => {
          return (
            query.queryKey[0] === 'allocation-agreements' &&
            query.queryKey.includes(complianceReportId)
          )
        }
      })

      if (invalidateRelatedQueries) {
        invalidateComplianceReportRelatedQueries(
          queryClient,
          complianceReportId
        )
        // Invalidate allocation organizations cache so charging site field updates
        queryClient.invalidateQueries({ queryKey: ['allocationOrganizations'] })
      }

      onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      onError?.(error, variables, context)
    },
    ...restOptions
  })
}

export const useGetAllocationAgreementImportJobStatus = (
  jobID: string | undefined | null,
  options: QueryOptions<unknown> = {}
) => {
  const client = useApiService()

  const {
    staleTime = JOB_STATUS_STALE_TIME,
    gcTime = 1 * 60 * 1000, // 1 minute cache for job status
    enabled = true,
    refetchInterval = 2000 as number | false, // Poll every 2 seconds for active jobs
    ...restOptions
  } = options

  return useQuery({
    queryKey: ['import-job-status', 'allocation-agreement', jobID],
    queryFn: async () => {
      if (!jobID) {
        throw new Error('Job ID is required')
      }

      const response = await client.get(
        apiRoutes.getImportAllocationAgreementsJobStatus.replace(
          ':jobID',
          jobID
        )
      )
      return response.data
    },
    enabled: enabled && !!jobID,
    staleTime,
    gcTime,
    refetchInterval: (data) => {
      // Stop polling when job is complete or failed
      const jobData = (data as any)?.state?.data
      if (jobData?.status === 'completed' || jobData?.status === 'failed') {
        return false
      }
      return refetchInterval as number | false
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...restOptions
  })
}
