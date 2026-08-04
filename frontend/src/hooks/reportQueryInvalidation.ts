import type { QueryClient } from '@tanstack/react-query'

export const invalidateComplianceReportRelatedQueries = (
  queryClient: QueryClient,
  complianceReportId: number | string | undefined | null
) => {
  queryClient.invalidateQueries({
    queryKey: ['compliance-report-summary', complianceReportId]
  })
  queryClient.invalidateQueries({
    queryKey: ['compliance-report', complianceReportId]
  })
  queryClient.invalidateQueries({
    queryKey: ['compliance-report-schedule-overview', complianceReportId]
  })
}
