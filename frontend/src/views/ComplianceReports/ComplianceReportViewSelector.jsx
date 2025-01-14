import { useGetComplianceReport } from '@/hooks/useComplianceReports.js'
import { useCurrentUser } from '@/hooks/useCurrentUser.js'
import Loading from '@/components/Loading.jsx'
import ViewLegacyComplianceReportWithAccess  from '@/views/ComplianceReports/ViewLegacyComplianceReport.jsx'
import { useParams } from 'react-router-dom'
import EditViewComplianceReportWithAccess from '@/views/ComplianceReports/EditViewComplianceReport.jsx'

export const ComplianceReportViewSelector = () => {
  const { complianceReportId } = useParams()
  const { data: currentUser, isLoading: isCurrentUserLoading } =
    useCurrentUser()

  const {
    data: reportData,
    isLoading: isReportLoading,
    isError,
    error
  } = useGetComplianceReport(
    currentUser?.organization?.organizationId,
    complianceReportId
  )

  if (isReportLoading || isCurrentUserLoading) {
    return <Loading />
  }

  return reportData.report.legacyId ? (
    <ViewLegacyComplianceReportWithAccess
      reportData={reportData}
      error={error}
      isError={isError}
    />
  ) : (
    <EditViewComplianceReportWithAccess
      reportData={reportData}
      error={error}
      isError={isError}
    />
  )
}
