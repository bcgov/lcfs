import { roles } from '@/constants/roles'
import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCurrentUser } from './useCurrentUser'

export const useCompliancePeriod = (options) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['compliance-periods'],
    queryFn: () => client.get(apiRoutes.getCompliancePeriods),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 60 * 60 * 1000, // 1 hour
    refetchInterval: 10 * 60 * 1000, // 10 minutes (optional)
    ...options
  })
}

export const useListComplianceReports = (orgID, options) => {
  const client = useApiService()
  const path = apiRoutes.getOrgComplianceReports.replace(':orgID', orgID)
  return useQuery({
    enabled: !!orgID,
    queryKey: ['compliance-reports', orgID],
    queryFn: () =>
      orgID &&
      client.post(path, {
        page: 0,
        size: 20,
        sort_orders: [],
        filters: []
      }),
    ...options
  })
}

export const useCreateComplianceReport = (orgID, options) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  const path = apiRoutes.createComplianceReport.replace(':orgID', orgID)
  return useMutation({
    mutationFn: (data) => client.post(path, data),
    onSettled: () => {
      queryClient.invalidateQueries(['compliance-report'])
    },
    ...options
  })
}

export const useGetComplianceReport = (orgID, reportID, options) => {
  const client = useApiService()
  const path = orgID
    ? apiRoutes.getOrgComplianceReport
        .replace(':orgID', orgID)
        .replace(':reportID', reportID)
    : apiRoutes.getComplianceReport.replace(':reportID', reportID)
  return useQuery({
    queryKey: ['compliance-report', reportID],
    queryFn: async () => {
      return (await client.get(path)).data
    },
    ...options
  })
}

export const useGetComplianceReportSummary = (reportID, options) => {
  const client = useApiService()
  const path = apiRoutes.getComplianceReportSummary.replace(
    ':reportID',
    reportID
  )
  return useQuery({
    enabled: !!reportID,
    queryKey: ['compliance-report-summary', reportID],
    queryFn: async () => {
      return (await client.get(path)).data
    },
    ...options
  })
}

export const useUpdateComplianceReportSummary = (reportID, options) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  const path = apiRoutes.updateComplianceReportSummary.replace(
    ':reportID',
    reportID
  )
  return useMutation({
    ...options,
    mutationFn: async (data) => {
      return await client.put(path, data)
    },
    onSuccess: (data) => {
      queryClient.setQueryData(
        ['compliance-report-summary', reportID],
        data.data
      )

      // Call original onSuccess callback to set summary data
      if (options?.onSuccess) {
        options.onSuccess(data)
      }
    }
  })
}

export const useUpdateComplianceReport = (reportID, options) => {
  const client = useApiService()
  const path = apiRoutes.updateComplianceReport.replace(':reportID', reportID)
  const queryClient = useQueryClient()

  return useMutation({
    ...options,
    mutationFn: async (data) => {
      return await client.put(path, data)
    },
    onSettled: (data) => {
      queryClient.setQueryData(['compliance-report', reportID], data.data)
    }
  })
}

export const useDeleteComplianceReport = (orgID, reportID, options) => {
  const client = useApiService()
  const { hasRoles } = useCurrentUser()
  const queryClient = useQueryClient()
  const path = (
    hasRoles(roles.government)
      ? apiRoutes.deleteComplianceReport
      : apiRoutes.deleteSupplementalReport.replace(':orgID', orgID)
  ).replace(':reportID', reportID)
  const queriesToInvalidate = [
    ['compliance-reports'],
    ['allocation-agreements', reportID],
    ['final-supply-equipments', reportID],
    ['fuel-exports', reportID],
    ['fuel-supplies', reportID],
    ['other-uses', reportID]
  ]
  return useMutation({
    mutationFn: async () => {
      return await client.delete(path)
    },
    onSuccess: () => {
      queriesToInvalidate.forEach((query) =>
        queryClient.invalidateQueries(query)
      )
      options.onSuccess?.()
    },
    ...options
  })
}

export const useComplianceReportDocuments = (parentID, options) => {
  const client = useApiService()

  return useQuery({
    queryKey: ['documents', 'compliance_report', parentID],
    queryFn: async () => {
      const path = apiRoutes.getDocuments
        .replace(':parentID', parentID)
        .replace(':parentType', 'compliance_report')

      const res = await client.get(path)
      return res.data
    },
    ...options
  })
}

export const useCreateSupplementalReport = (reportID, options) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  const path = apiRoutes.createSupplementalReport.replace(':reportID', reportID)

  return useMutation({
    mutationFn: () => client.post(path),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['compliance-reports'])
      if (options && options.onSuccess) {
        options.onSuccess(data)
      }
    },
    onError: (error) => {
      if (options && options.onError) {
        options.onError(error)
      }
    }
  })
}

export const useCreateAnalystAdjustment = (reportID, options) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  const path = apiRoutes.createAnalystAdjustment.replace(':reportID', reportID)

  return useMutation({
    mutationFn: () => client.post(path),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['compliance-reports'])
      if (options && options.onSuccess) {
        options.onSuccess(data)
      }
    },
    onError: (error) => {
      if (options && options.onError) {
        options.onError(error)
      }
    }
  })
}

export const useGetComplianceReportList = (
  { page = 1, size = 10, sortOrders = [], filters = [] } = {},
  options
) => {
  const client = useApiService()
  const { data: currentUser, hasRoles, isLoading } = useCurrentUser()

  return useQuery({
    enabled: !isLoading,
    queryKey: ['compliance-reports-list', page, size, sortOrders, filters],
    queryFn: async () => {
      if (hasRoles(roles.supplier)) {
        return (
          await client.post(
            apiRoutes.getOrgComplianceReports.replace(
              ':orgID',
              currentUser?.organization?.organizationId
            ),
            {
              page,
              size,
              sortOrders,
              filters
            }
          )
        ).data
      } else {
        return (
          await client.post(apiRoutes.getComplianceReports, {
            page,
            size,
            sortOrders,
            filters
          })
        ).data
      }
    },
    ...options
  })
}

export const useGetComplianceReportStatuses = (options) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['compliance-report-statuses'],
    queryFn: async () =>
      (await client.get(apiRoutes.getComplianceReportStatuses)).data,
    ...options
  })
}
