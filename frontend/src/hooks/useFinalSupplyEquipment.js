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

export const useGetFSEReportingList = (
  complianceReportId,
  pagination = { page: 1, size: 10, filters: [], sort_orders: [] },
  options = {},
  organizationId = null,
  mode = undefined
) => {
  const client = useApiService()

  const {
    staleTime = DEFAULT_STALE_TIME,
    cacheTime = DEFAULT_CACHE_TIME,
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: [
      'fse-reporting-list',
      complianceReportId,
      organizationId,
      pagination
    ],
    queryFn: async () => {
      if (!organizationId) {
        throw new Error('Organization ID is required')
      }

      // Build query params conditionally
      const queryParams = new URLSearchParams()

      if (organizationId) {
        queryParams.append('organizationId', organizationId)
      }

      if (complianceReportId) {
        queryParams.append('complianceReportId', complianceReportId)
      }
      if (mode) {
        queryParams.append('mode', mode)
      }

      const queryString = queryParams.toString()
      const url = `/final-supply-equipments/reporting/list${queryString ? `?${queryString}` : ''}`

      const response = await client.post(url, pagination)
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

export const useSaveFSEReporting = (
  organizationId,
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
      if (!organizationId) {
        throw new Error('Organization ID is required')
      }
      if (!complianceReportId) {
        throw new Error('Compliance report ID is required')
      }

      // Handle batch operations for multiple selected rows
      if (Array.isArray(data)) {
        return await client.post(apiRoutes.saveFSEReportingBatch, {
          fseReports: [...data],
          complianceReportId,
          organizationId
        })
      }

      const chargingEquipmentComplianceId =
        data.chargingEquipmentComplianceId || null

      // UPDATE operation (has ID and not deleted)
      if (chargingEquipmentComplianceId) {
        return await client.put(
          `/final-supply-equipments/reporting/${chargingEquipmentComplianceId}`,
          { ...data }
        )
      }
    },
    onSuccess: (data, variables, context) => {
      if (clearCache) {
        // Remove all FSE reporting queries from cache
        queryClient.removeQueries({
          queryKey: ['fse-reporting-list']
        })
      } else {
        // Invalidate FSE reporting list queries for this compliance report
        queryClient.invalidateQueries({
          predicate: (query) => {
            return (
              query.queryKey[0] === 'fse-reporting-list' &&
              query.queryKey[1] === complianceReportId
            )
          }
        })
      }

      if (invalidateRelatedQueries) {
        // Invalidate compliance report related queries
        queryClient.invalidateQueries({
          queryKey: ['compliance-report-summary', complianceReportId]
        })
        queryClient.invalidateQueries({
          queryKey: ['compliance-report', complianceReportId]
        })
        queryClient.invalidateQueries({
          queryKey: ['final-supply-equipments', complianceReportId]
        })
      }

      onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      // Invalidate on error to ensure fresh data on retry
      queryClient.invalidateQueries({
        predicate: (query) => {
          return (
            query.queryKey[0] === 'fse-reporting-list' &&
            query.queryKey[1] === complianceReportId
          )
        }
      })

      onError?.(error, variables, context)
    },
    retry: 0,
    ...restOptions
  })
}

export const useDeleteFSEReportingBatch = (
  complianceReportId,
  organizationId = null,
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
    mutationFn: async (reportingIds) => {
      if (!Array.isArray(reportingIds) || reportingIds.length === 0) {
        throw new Error('Reporting IDs array is required')
      }

      return await client.delete(apiRoutes.saveFSEReportingBatch, {
        data: { reportingIds, complianceReportId, organizationId }
      })
    },
    onSuccess: (data, variables, context) => {
      // Invalidate FSE reporting list queries for this compliance report
      queryClient.invalidateQueries({
        predicate: (query) => {
          return (
            query.queryKey[0] === 'fse-reporting-list' &&
            query.queryKey[1] === complianceReportId
          )
        }
      })

      if (invalidateRelatedQueries) {
        // Invalidate compliance report related queries
        queryClient.invalidateQueries({
          queryKey: ['compliance-report-summary', complianceReportId]
        })
        queryClient.invalidateQueries({
          queryKey: ['compliance-report', complianceReportId]
        })
        queryClient.invalidateQueries({
          queryKey: ['final-supply-equipments', complianceReportId]
        })
      }

      onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      // Invalidate on error to ensure fresh data on retry
      queryClient.invalidateQueries({
        predicate: (query) => {
          return (
            query.queryKey[0] === 'fse-reporting-list' &&
            query.queryKey[1] === complianceReportId
          )
        }
      })

      onError?.(error, variables, context)
    },
    ...restOptions
  })
}

export const useSetFSEReportingDefaultDates = (
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
    mutationFn: async (data) => {
      return await client.post(
        '/final-supply-equipments/reporting/set-default',
        data
      )
    },
    onSuccess: (data, variables, context) => {
      // Invalidate FSE reporting list queries for this compliance report
      queryClient.invalidateQueries({
        predicate: (query) => {
          return (
            query.queryKey[0] === 'fse-reporting-list' &&
            query.queryKey[1] === complianceReportId
          )
        }
      })

      if (invalidateRelatedQueries) {
        queryClient.invalidateQueries({
          queryKey: ['compliance-report-summary', complianceReportId]
        })
        queryClient.invalidateQueries({
          queryKey: ['compliance-report', complianceReportId]
        })
      }

      onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      onError?.(error, variables, context)
    },
    ...restOptions
  })
}

/**
 * Hook to fetch ALL FSE/Charging Equipment data for the map view.
 */
export const useGetAllFSEForMap = (
  complianceReportId,
  organizationId,
  options = {}
) => {
  const client = useApiService()

  const {
    staleTime = 5 * 60 * 1000, // 5 minutes - map data doesn't change frequently
    cacheTime = 10 * 60 * 1000, // 10 minutes
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: ['fse-map-data', complianceReportId, organizationId],
    queryFn: async () => {
      // Organization is mandatory only when we're scoped to a specific report
      if (complianceReportId && !organizationId) {
        throw new Error('Organization ID is required when viewing a report')
      }

      // If we have a compliance report ID, use the FSE reporting endpoint
      if (complianceReportId) {
        const params = new URLSearchParams({
          organizationId: String(organizationId),
          complianceReportId: String(complianceReportId),
          mode: 'summary'
        })

        const response = await client.post(
          `/final-supply-equipments/reporting/list?${params}`,
          { page: 1, size: 10000, filters: [], sort_orders: [] }
        )

        // Transform FSE reporting data to consistent camelCase format
        const items = response.data?.finalSupplyEquipments || []
        return {
          finalSupplyEquipments: items.map((eq) => ({
            chargingEquipmentId:
              eq.charging_equipment_id || eq.chargingEquipmentId,
            chargingSiteId: eq.charging_site_id || eq.chargingSiteId,
            siteName: eq.site_name || eq.siteName,
            organizationName: eq.organization_name || eq.organizationName,
            latitude: eq.latitude,
            longitude: eq.longitude,
            // Charging site coordinates (from the site itself, not equipment)
            siteLatitude: eq.siteLatitude || eq.site_latitude,
            siteLongitude: eq.siteLongitude || eq.site_longitude,
            registrationNumber: eq.registration_number || eq.registrationNumber,
            serialNumber: eq.serial_number || eq.serialNumber,
            manufacturer: eq.manufacturer,
            model: eq.model,
            levelOfEquipmentName: eq.level_of_equipment || eq.levelOfEquipment,
            ports: eq.ports,
            status: eq.status || 'Draft',
            intendedUses: eq.intended_uses || eq.intendedUses || [],
            intendedUsers: eq.intended_users || eq.intendedUsers || [],
            streetAddress: eq.street_address || eq.streetAddress,
            city: eq.city,
            postalCode: eq.postal_code || eq.postalCode
          })),
          pagination: response.data?.pagination,
          totalCount: response.data?.pagination?.total || items.length
        }
      }

      // Fetch all charging equipment (optionally filtered by organization)
      const requestBody = {
        page: 1,
        size: 10000,
        filters: [],
        sort_orders: []
      }

      if (organizationId) {
        requestBody.organization_id = organizationId
      }

      const response = await client.post(
        '/charging-equipment/list',
        requestBody
      )

      // Transform API response - handle both camelCase and snake_case
      const items = response.data?.items || []

      return {
        finalSupplyEquipments: items.map((eq) => ({
          chargingEquipmentId:
            eq.chargingEquipmentId || eq.charging_equipment_id,
          chargingSiteId: eq.chargingSiteId || eq.charging_site_id,
          registrationNumber:
            eq.registrationNumber ||
            eq.registration_number ||
            eq.equipment_number,
          organizationName: eq.organizationName || eq.organization_name,
          siteName: eq.siteName || eq.site_name,
          latitude: eq.latitude,
          longitude: eq.longitude,
          // Charging site coordinates (from the site itself, not equipment)
          siteLatitude: eq.siteLatitude || eq.site_latitude,
          siteLongitude: eq.siteLongitude || eq.site_longitude,
          levelOfEquipmentName:
            eq.levelOfEquipmentName || eq.level_of_equipment_name,
          ports: eq.ports,
          serialNumber: eq.serialNumber || eq.serial_number,
          manufacturer: eq.manufacturer,
          model: eq.model,
          version: eq.version,
          status: eq.status,
          intendedUses: eq.intendedUses || eq.intended_uses || [],
          intendedUsers: eq.intendedUsers || eq.intended_users || [],
          streetAddress: eq.streetAddress || eq.street_address,
          city: eq.city || eq.town || eq.locality,
          postalCode: eq.postalCode || eq.postal_code,
          createdDate: eq.createdDate || eq.created_date,
          updatedDate: eq.updatedDate || eq.updated_date
        })),
        pagination: response.data?.pagination,
        totalCount: response.data?.pagination?.total || items.length
      }
    },
    enabled: enabled && (complianceReportId ? !!organizationId : true),
    staleTime,
    cacheTime,
    retry: 2,
    retryDelay: 1000,
    ...restOptions
  })
}
