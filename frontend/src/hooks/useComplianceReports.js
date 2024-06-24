import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const useCompliancePeriod = (options) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['compliance-periods'],
    queryFn: () => client.get(apiRoutes.getCompliancePeriods),
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

export const useGetComplianceReport = (orgID, complianceReportId, options) => {
  const client = useApiService()
  const path = orgID
    ? apiRoutes.getOrgComplianceReport
        .replace(':complianceReportId', complianceReportId)
    : apiRoutes.getComplianceReport.replace(':complianceReportId', complianceReportId)
  return useQuery({
    queryKey: ['compliance-report', complianceReportId],
    queryFn: () => client.get(path),
    ...options
  })
}