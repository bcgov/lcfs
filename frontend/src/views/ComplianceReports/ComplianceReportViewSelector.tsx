import { useQueryClient } from '@tanstack/react-query'
import { useGetComplianceReport } from '@/hooks/useComplianceReports.js'
import { useCurrentUser } from '@/hooks/useCurrentUser.js'
import Loading from '@/components/Loading'
import { useLocation, useParams } from 'react-router-dom'
import { EditViewComplianceReport } from '@/views/ComplianceReports/EditViewComplianceReport'
import { useEffect } from 'react'
import '@/stores/useComplianceReportStore'

export const ComplianceReportViewSelector = () => {
  const { complianceReportId } = useParams()
  const { data: currentUser, isLoading: isCurrentUserLoading } =
    useCurrentUser()
  const location = useLocation()
  const queryClient = useQueryClient()

  const {
    data: reportData,
    isLoading: isReportLoading,
    isError,
    error,
    refetch
  } = useGetComplianceReport(
    currentUser?.organization?.organizationId,
    complianceReportId,
    {
      enabled: !isCurrentUserLoading
    }
  )

  const locationState: unknown = location.state
  const requestedReportStatus =
    typeof locationState === 'object' &&
    locationState !== null &&
    'reportStatus' in locationState &&
    typeof locationState.reportStatus === 'string'
      ? locationState.reportStatus
      : undefined
  const currentReportStatus = reportData?.report?.currentStatus?.status
  const hasReportData = Boolean(reportData)

  useEffect(() => {
    // if the status of the report doesn't match with the cached report data then refetch by invalidating cache
    if (
      hasReportData &&
      requestedReportStatus &&
      requestedReportStatus !== currentReportStatus
    ) {
      queryClient.invalidateQueries({
        queryKey: ['compliance-report', complianceReportId]
      })
      refetch()
    }
  }, [
    complianceReportId,
    currentReportStatus,
    hasReportData,
    queryClient,
    refetch,
    requestedReportStatus
  ])

  if (isReportLoading || isCurrentUserLoading) {
    return <Loading />
  }

  // All reports (including historical TFRS-migrated reports) use the standard LCFS view
  // TFRS data is migrated into existing LCFS tables and displays normally
  return <EditViewComplianceReport error={error} isError={isError} />
}
