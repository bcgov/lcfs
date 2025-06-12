import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

// Default cache configuration
const DEFAULT_STALE_TIME = 5 * 60 * 1000 // 5 minutes
const DEFAULT_CACHE_TIME = 10 * 60 * 1000 // 10 minutes
const OPTIONS_STALE_TIME = 30 * 60 * 1000 // 30 minutes (options change less frequently)
const JOB_STATUS_STALE_TIME = 0 // Real-time for job status

export const useFinalSupplyEquipmentOptions = (options = {}) => {
  const client = useApiService()

  const {
    staleTime = OPTIONS_STALE_TIME,
    cacheTime = DEFAULT_CACHE_TIME,
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: ['final-supply-equipment-options'],
    queryFn: async () => {
      const response = await client.get(apiRoutes.finalSupplyEquipmentOptions)
      return response.data
    },
    enabled,
    staleTime,
    cacheTime,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...restOptions
  })
}

export const useGetFinalSupplyEquipments = (
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
    queryKey: ['final-supply-equipments', complianceReportId, pagination],
    queryFn: async () => {
      if (!complianceReportId) {
        throw new Error('Compliance report ID is required')
      }

      const response = await client.post(
        apiRoutes.getAllFinalSupplyEquipments,
        { complianceReportId, ...pagination }
      )
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

export const useSaveFinalSupplyEquipment = (
  complianceReportId,
  options = {}
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
    mutationFn: async (data) => {
      if (!complianceReportId) {
        throw new Error('Compliance report ID is required')
      }

      const modifiedData = {
        ...data,
        levelOfEquipment: data.levelOfEquipment?.name || data.levelOfEquipment,
        complianceReportId
      }

      return await client.post(
        apiRoutes.saveFinalSupplyEquipments,
        modifiedData
      )
    },
    onSuccess: (data, variables, context) => {
      if (clearCache) {
        queryClient.removeQueries([
          'final-supply-equipments',
          complianceReportId
        ])
      } else {
        // Invalidate all variations of final supply equipment queries for this report
        queryClient.invalidateQueries({
          predicate: (query) => {
            return (
              query.queryKey[0] === 'final-supply-equipments' &&
              query.queryKey[1] === complianceReportId
            )
          }
        })
      }

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
      // Invalidate on error to ensure fresh data on retry
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

export const useUpdateFinalSupplyEquipment = (
  complianceReportId,
  options = {}
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
    mutationFn: async (data) => {
      if (!complianceReportId) {
        throw new Error('Compliance report ID is required')
      }
      if (!data?.id) {
        throw new Error('Equipment ID is required for update')
      }

      const modifiedData = {
        ...data,
        levelOfEquipment: data.levelOfEquipment?.name || data.levelOfEquipment,
        complianceReportId
      }

      return await client.put(
        `${apiRoutes.saveFinalSupplyEquipments}/${data.id}`,
        modifiedData
      )
    },
    onSuccess: (data, variables, context) => {
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

export const useDeleteFinalSupplyEquipment = (
  complianceReportId,
  options = {}
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
    mutationFn: async (equipmentId) => {
      if (!complianceReportId) {
        throw new Error('Compliance report ID is required')
      }
      if (!equipmentId) {
        throw new Error('Equipment ID is required for deletion')
      }

      return await client.delete(
        `${apiRoutes.saveFinalSupplyEquipments}/${equipmentId}`
      )
    },
    onSuccess: (data, variables, context) => {
      // Always invalidate after deletion to ensure removed item is gone from cache
      queryClient.invalidateQueries({
        predicate: (query) => {
          return (
            query.queryKey[0] === 'final-supply-equipments' &&
            query.queryKey[1] === complianceReportId
          )
        }
      })

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

export const useImportFinalSupplyEquipment = (
  complianceReportId,
  options = {}
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
    mutationFn: async ({ file, isOverwrite }) => {
      if (!complianceReportId) {
        throw new Error('Compliance report ID is required')
      }
      if (!file) {
        throw new Error('File is required for import')
      }

      const path = apiRoutes.importFinalSupplyEquipments.replace(
        ':reportID',
        complianceReportId
      )

      const formData = new FormData()
      formData.append('file', file)
      formData.append('filename', file.name)
      formData.append('overwrite', isOverwrite)

      return await client.post(path, formData, {
        accept: 'application/json',
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
    },
    onSuccess: (data, variables, context) => {
      // Invalidate all final supply equipment queries for this report
      queryClient.invalidateQueries({
        predicate: (query) => {
          return (
            query.queryKey[0] === 'final-supply-equipments' &&
            query.queryKey[1] === complianceReportId
          )
        }
      })

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
      onError?.(error, variables, context)
    },
    ...restOptions
  })
}

export const useGetFinalSupplyEquipmentImportJobStatus = (
  jobID,
  options = {}
) => {
  const client = useApiService()

  const {
    staleTime = JOB_STATUS_STALE_TIME,
    cacheTime = 1 * 60 * 1000, // 1 minute cache for job status
    enabled = true,
    refetchInterval = 2000, // Poll every 2 seconds for active jobs
    ...restOptions
  } = options

  return useQuery({
    queryKey: ['import-job-status', 'final-supply-equipment', jobID],
    queryFn: async () => {
      if (!jobID) {
        throw new Error('Job ID is required')
      }

      const response = await client.get(
        apiRoutes.getImportFinalSupplyEquipmentsJobStatus.replace(
          ':jobID',
          jobID
        )
      )
      return response.data
    },
    enabled: enabled && !!jobID,
    staleTime,
    cacheTime,
    refetchInterval: (data) => {
      // Stop polling when job is complete or failed
      if (data?.status === 'completed' || data?.status === 'failed') {
        return false
      }
      return refetchInterval
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...restOptions
  })
}
