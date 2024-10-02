import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

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
    queryFn: () => client.get(path),
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
    queryKey: ['compliance-report-summary', reportID],
    queryFn: async () => {
      return (await client.get(path)).data
    },
    ...options
  })
}

export const useUpdateComplianceReportSummary = (
  reportId,
  options
) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  const path = apiRoutes.updateComplianceReportSummary
    .replace(':reportID', reportId)
  return useMutation({
    ...options,
    mutationFn: async (data) => {
      return await client.put(path, data)
    },
    onSuccess: (data) => {
      queryClient.setQueryData(
        ['compliance-report-summary', reportId],
        data.data
      )
    }
  })
}

export const useUpdateComplianceReport = (reportID, options) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  const path = apiRoutes.updateComplianceReport.replace(':reportID', reportID)

  return useMutation({
    ...options,
    mutationFn: async (data) => {
      return await client.put(path, data)
    },
    onSettled: () => {
      queryClient.invalidateQueries(['compliance-report', reportID])
    }
  })
}

export const useComplianceReportDocuments = (reportID, options) => {
  const client = useApiService()
  const path = apiRoutes.getComplianceReportDocuments.replace(
    ':reportID',
    reportID
  )

  return useQuery({
    queryKey: ['compliance-report-documents', reportID],
    queryFn: async () => {
      const res = await client.get(path)
      return res.data
    },
    ...options
  })
}

export const useUploadComplianceReportDocument = (reportID, options) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  const path = apiRoutes.getComplianceReportDocuments.replace(
    ':reportID',
    reportID
  )

  return useMutation({
    ...options,
    mutationFn: async (file) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('filename', file.name)

      return await client.post(path, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['compliance-report-documents', reportID])
    }
  })
}

export const useDeleteComplianceReportDocument = (reportID, options) => {
  const client = useApiService()
  const queryClient = useQueryClient()

  return useMutation({
    ...options,
    mutationFn: async (documentID) => {
      const path = apiRoutes.getComplianceReportDocumentUrl
        .replace(':reportID', reportID)
        .replace(':documentID', documentID)
      return await client.delete(path)
    },
    onSettled: () => {
      queryClient.invalidateQueries(['compliance-report-documents', reportID])
    }
  })
}
