import { roles } from '@/constants/roles'
import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCurrentUser } from './useCurrentUser'
import useComplianceReportStore from '@/stores/useComplianceReportStore.js'

// Default cache configuration
const DEFAULT_STALE_TIME = 5 * 60 * 1000 // 5 minutes
const DEFAULT_CACHE_TIME = 10 * 60 * 1000 // 10 minutes
const STATIC_DATA_STALE_TIME = 60 * 60 * 1000 // 1 hour (for periods, statuses)
const DOCUMENT_STALE_TIME = 10 * 60 * 1000 // 10 minutes (documents change less frequently)

export const useCompliancePeriod = (options = {}) => {
  const client = useApiService()

  const {
    staleTime = STATIC_DATA_STALE_TIME,
    cacheTime = STATIC_DATA_STALE_TIME,
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: ['compliance-periods'],
    queryFn: async () => {
      const response = await client.get(apiRoutes.getCompliancePeriods)
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

export const useListComplianceReports = (orgID, options = {}) => {
  const client = useApiService()

  const {
    staleTime = DEFAULT_STALE_TIME,
    cacheTime = DEFAULT_CACHE_TIME,
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: ['compliance-reports', orgID],
    queryFn: async () => {
      if (!orgID) {
        throw new Error('Organization ID is required')
      }
      const path = apiRoutes.getOrgComplianceReports.replace(':orgID', orgID)
      const response = await client.post(path, {
        page: 0,
        size: 20,
        sort_orders: [],
        filters: []
      })
      return response.data
    },
    enabled: enabled && !!orgID,
    staleTime,
    cacheTime,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...restOptions
  })
}

export const useCreateComplianceReport = (orgID, options = {}) => {
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
      if (!orgID) {
        throw new Error('Organization ID is required')
      }
      const path = apiRoutes.createComplianceReport.replace(':orgID', orgID)
      return await client.post(path, data)
    },
    onSuccess: (data, variables, context) => {
      if (invalidateRelatedQueries) {
        queryClient.invalidateQueries(['compliance-reports'])
        queryClient.invalidateQueries(['compliance-reports-list'])
      }
      onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      onError?.(error, variables, context)
    },
    ...restOptions
  })
}

export const useGetComplianceReport = (orgID, reportID, options = {}) => {
  const client = useApiService()
  const { setCurrentReport, cacheReport } = useComplianceReportStore()

  const {
    staleTime = DEFAULT_STALE_TIME,
    cacheTime = DEFAULT_CACHE_TIME,
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: ['compliance-report', reportID],
    queryFn: async () => {
      if (!reportID) {
        throw new Error('Report ID is required')
      }

      const path = orgID
        ? apiRoutes.getOrgComplianceReport
            .replace(':orgID', orgID)
            .replace(':reportID', reportID)
        : apiRoutes.getComplianceReport.replace(':reportID', reportID)

      const { data } = await client.get(path)
      setCurrentReport(data)
      cacheReport(reportID, data)
      return data
    },
    enabled: enabled && !!reportID,
    staleTime,
    cacheTime,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...restOptions
  })
}

export const useGetComplianceReportSummary = (reportID, options = {}) => {
  const client = useApiService()

  const {
    staleTime = DEFAULT_STALE_TIME,
    cacheTime = DEFAULT_CACHE_TIME,
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: ['compliance-report-summary', reportID],
    queryFn: async () => {
      if (!reportID) {
        throw new Error('Report ID is required')
      }
      const path = apiRoutes.getComplianceReportSummary.replace(
        ':reportID',
        reportID
      )
      const response = await client.get(path)
      return response.data
    },
    enabled: enabled && !!reportID,
    staleTime,
    cacheTime,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...restOptions
  })
}

export const useUpdateComplianceReportSummary = (reportID, options = {}) => {
  const client = useApiService()
  const queryClient = useQueryClient()

  const { onSuccess, onError, clearCache = false, ...restOptions } = options

  return useMutation({
    mutationFn: async (data) => {
      if (!reportID) {
        throw new Error('Report ID is required')
      }
      const path = apiRoutes.updateComplianceReportSummary.replace(
        ':reportID',
        reportID
      )
      return await client.put(path, data)
    },
    onSuccess: (data, variables, context) => {
      if (clearCache) {
        queryClient.removeQueries(['compliance-report-summary', reportID])
      } else {
        queryClient.setQueryData(
          ['compliance-report-summary', reportID],
          data.data
        )
      }

      onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      queryClient.invalidateQueries(['compliance-report-summary', reportID])
      onError?.(error, variables, context)
    },
    ...restOptions
  })
}

export const useUpdateComplianceReport = (reportID, options = {}) => {
  const client = useApiService()
  const { removeReport, cacheReport, setCurrentReport } =
    useComplianceReportStore()
  const queryClient = useQueryClient()

  const {
    onSuccess,
    onError,
    clearCache = false,
    invalidateRelatedQueries = true,
    ...restOptions
  } = options

  return useMutation({
    mutationFn: async (data) => {
      if (!reportID) {
        throw new Error('Report ID is required')
      }
      const path = apiRoutes.updateComplianceReport.replace(
        ':reportID',
        reportID
      )
      return await client.put(path, data)
    },
    onSuccess: (data, variables, context) => {
      // Update cache and store
      if (clearCache) {
        queryClient.removeQueries(['compliance-report', reportID])
      } else {
        queryClient.setQueryData(['compliance-report', reportID], data.data)
      }

      removeReport(reportID)
      if (data?.data) {
        setCurrentReport(data.data)
        cacheReport(reportID, data.data)
      }

      if (invalidateRelatedQueries) {
        queryClient.invalidateQueries(['compliance-reports'])
        queryClient.invalidateQueries(['compliance-reports-list'])
      }

      onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      queryClient.invalidateQueries(['compliance-report', reportID])
      onError?.(error, variables, context)
    },
    ...restOptions
  })
}

export const useDeleteComplianceReport = (orgID, reportID, options = {}) => {
  const client = useApiService()
  const { hasRoles } = useCurrentUser()
  const queryClient = useQueryClient()

  const { onSuccess, onError, ...restOptions } = options

  return useMutation({
    mutationFn: async () => {
      if (!reportID) {
        throw new Error('Report ID is required')
      }

      const path = (
        hasRoles(roles.government)
          ? apiRoutes.deleteComplianceReport
          : apiRoutes.deleteSupplementalReport.replace(':orgID', orgID)
      ).replace(':reportID', reportID)

      return await client.delete(path)
    },
    onSuccess: (data, variables, context) => {
      const queriesToInvalidate = [
        ['compliance-reports'],
        ['compliance-reports-list'],
        ['allocation-agreements', reportID],
        ['final-supply-equipments', reportID],
        ['fuel-exports', reportID],
        ['fuel-supplies', reportID],
        ['other-uses', reportID]
      ]

      queriesToInvalidate.forEach((query) =>
        queryClient.invalidateQueries(query)
      )

      onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      onError?.(error, variables, context)
    },
    ...restOptions
  })
}

export const useComplianceReportDocuments = (parentID, options = {}) => {
  const client = useApiService()

  const {
    staleTime = DOCUMENT_STALE_TIME,
    cacheTime = DEFAULT_CACHE_TIME,
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: ['documents', 'compliance_report', parentID],
    queryFn: async () => {
      if (!parentID) {
        throw new Error('Parent ID is required')
      }

      const path = apiRoutes.getDocuments
        .replace(':parentID', parentID)
        .replace(':parentType', 'compliance_report')

      const response = await client.get(path)
      return response.data
    },
    enabled: enabled && !!parentID,
    staleTime,
    cacheTime,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...restOptions
  })
}

export const useCreateSupplementalReport = (reportID, options = {}) => {
  const client = useApiService()
  const queryClient = useQueryClient()

  const {
    onSuccess,
    onError,
    invalidateRelatedQueries = true,
    ...restOptions
  } = options

  return useMutation({
    mutationFn: async () => {
      if (!reportID) {
        throw new Error('Report ID is required')
      }
      const path = apiRoutes.createSupplementalReport.replace(
        ':reportID',
        reportID
      )
      return await client.post(path)
    },
    onSuccess: (data, variables, context) => {
      if (invalidateRelatedQueries) {
        queryClient.invalidateQueries(['compliance-reports'])
        queryClient.invalidateQueries(['compliance-reports-list'])
      }
      onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      onError?.(error, variables, context)
    },
    ...restOptions
  })
}

export const useCreateAnalystAdjustment = (reportID, options = {}) => {
  const client = useApiService()
  const queryClient = useQueryClient()

  const {
    onSuccess,
    onError,
    invalidateRelatedQueries = true,
    ...restOptions
  } = options

  return useMutation({
    mutationFn: async () => {
      if (!reportID) {
        throw new Error('Report ID is required')
      }
      const path = apiRoutes.createAnalystAdjustment.replace(
        ':reportID',
        reportID
      )
      return await client.post(path)
    },
    onSuccess: (data, variables, context) => {
      if (invalidateRelatedQueries) {
        queryClient.invalidateQueries(['compliance-reports'])
        queryClient.invalidateQueries(['compliance-reports-list'])
      }
      onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      onError?.(error, variables, context)
    },
    ...restOptions
  })
}

export const useCreateIdirSupplementalReport = (reportID, options = {}) => {
  const client = useApiService()
  const queryClient = useQueryClient()

  const {
    onSuccess,
    onError,
    invalidateRelatedQueries = true,
    ...restOptions
  } = options

  return useMutation({
    mutationFn: async () => {
      if (!reportID) {
        throw new Error('Report ID is required')
      }
      const path = apiRoutes.createIdirSupplementalReport.replace(
        ':reportID',
        reportID
      )
      return await client.post(path)
    },
    onSuccess: (data, variables, context) => {
      if (invalidateRelatedQueries) {
        queryClient.invalidateQueries(['compliance-reports-list'])
        queryClient.invalidateQueries(['compliance-report', reportID])
      }
      onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      onError?.(error, variables, context)
    },
    ...restOptions
  })
}

export const useGetComplianceReportList = (
  { page = 1, size = 10, sortOrders = [], filters = [] } = {},
  options = {}
) => {
  const client = useApiService()
  const { data: currentUser, hasRoles, isLoading } = useCurrentUser()

  const {
    staleTime = DEFAULT_STALE_TIME,
    cacheTime = DEFAULT_CACHE_TIME,
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: ['compliance-reports-list', page, size, sortOrders, filters],
    queryFn: async () => {
      if (hasRoles(roles.supplier)) {
        const orgId = currentUser?.organization?.organizationId
        if (!orgId) {
          throw new Error('Organization ID not found for supplier')
        }

        const response = await client.post(
          apiRoutes.getOrgComplianceReports.replace(':orgID', orgId),
          { page, size, sortOrders, filters }
        )
        return response.data
      } else {
        const response = await client.post(apiRoutes.getComplianceReports, {
          page,
          size,
          sortOrders,
          filters
        })
        return response.data
      }
    },
    enabled: enabled && !isLoading,
    staleTime,
    cacheTime,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...restOptions
  })
}

export const useGetComplianceReportStatuses = (options = {}) => {
  const client = useApiService()

  const {
    staleTime = STATIC_DATA_STALE_TIME,
    cacheTime = STATIC_DATA_STALE_TIME,
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: ['compliance-report-statuses'],
    queryFn: async () => {
      const response = await client.get(apiRoutes.getComplianceReportStatuses)
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

export const useGetChangeLog = (
  { complianceReportGroupUuid, dataType },
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
    queryKey: ['changelog', complianceReportGroupUuid, dataType],
    queryFn: async () => {
      if (!complianceReportGroupUuid || !dataType) {
        throw new Error(
          'Compliance Report Group UUID and Data Type are required'
        )
      }

      const path = apiRoutes.getChangelog
        .replace(':complianceReportGroupUuid', complianceReportGroupUuid)
        .replace(':dataType', dataType)

      const response = await client.get(path)
      return response.data
    },
    enabled: enabled && !!complianceReportGroupUuid && !!dataType,
    staleTime,
    cacheTime,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...restOptions
  })
}
