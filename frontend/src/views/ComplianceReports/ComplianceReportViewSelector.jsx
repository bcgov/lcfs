import { useQueryClient } from '@tanstack/react-query'
import { useGetComplianceReport } from '@/hooks/useComplianceReports.js'
import { useCurrentUser } from '@/hooks/useCurrentUser.js'
import Loading from '@/components/Loading.jsx'
import { useLocation, useParams } from 'react-router-dom'
import { EditViewComplianceReport } from '@/views/ComplianceReports/EditViewComplianceReport.jsx'
import { useEffect } from 'react'
import useComplianceReportStore from '@/stores/useComplianceReportStore'

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

  useEffect(() => {
    // if the status of the report doesn't match with the cached report data then refetch by invalidating cache
    if (
      reportData &&
      location.state?.reportStatus &&
      location.state?.reportStatus !== reportData?.report?.currentStatus.status
    ) {
      queryClient.invalidateQueries(['compliance-report', complianceReportId])
      refetch()
    }
  }, [location.state, reportData?.report?.currentStatus.status])

  if (isReportLoading || isCurrentUserLoading) {
    return <Loading />
  }

  // All reports (including historical TFRS-migrated reports) use the standard LCFS view
  // TFRS data is migrated into existing LCFS tables and displays normally
  return (
    <EditViewComplianceReport
      reportData={reportData}
      error={error}
      isError={isError}
    />
  )
}
