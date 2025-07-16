import { useQueryClient } from '@tanstack/react-query'
import { useGetComplianceReport } from '@/hooks/useComplianceReports.js'
import { useCurrentUser } from '@/hooks/useCurrentUser.js'
import Loading from '@/components/Loading.jsx'
import { ViewLegacyComplianceReport } from '@/views/ComplianceReports/ViewLegacyComplianceReport.jsx'
import { useLocation, useParams } from 'react-router-dom'
import { EditViewComplianceReport } from '@/views/ComplianceReports/EditViewComplianceReport.jsx'
import { useEffect } from 'react'
import useComplianceReportStore from '@/stores/useComplianceReportStore'
import { FEATURE_FLAGS, isFeatureEnabled } from '@/constants/config.js'

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

  // Determine which view to show:
  // - 2024+ reports: always show full view
  // - Pre-2024 reports: use feature flag to control view
  const reportYear =
    reportData?.report?.compliancePeriod?.description &&
    parseInt(reportData.report.compliancePeriod.description)

  const showLegacyView =
    reportYear < 2024 && !isFeatureEnabled(FEATURE_FLAGS.LEGACY_REPORT_DETAILS)

  return showLegacyView ? (
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
