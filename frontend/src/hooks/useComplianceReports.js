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
  const path = apiRoutes.getComplianceReportSummary.replace(':reportID', reportID)
  return useQuery({
    queryKey: ['compliance-report-summary', reportID],
    queryFn: async () => {
      return (
        await client.get(path)
      ).data
    },
    ...options
  })
}
