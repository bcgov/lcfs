import { useQueryClient } from '@tanstack/react-query'
import { useGetComplianceReport } from '@/hooks/useComplianceReports.js'
import { useCurrentUser } from '@/hooks/useCurrentUser.js'
import Loading from '@/components/Loading.jsx'
import { ViewLegacyComplianceReport } from '@/views/ComplianceReports/ViewLegacyComplianceReport.jsx'
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

  return reportData.report.legacyId ? (
    <ViewLegacyComplianceReport
      reportData={reportData}
      error={error}
      isError={isError}
    />
  ) : (
    <EditViewComplianceReport
      reportData={reportData}
      error={error}
      isError={isError}
    />
  )
}
