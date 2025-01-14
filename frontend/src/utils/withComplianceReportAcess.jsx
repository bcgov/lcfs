import { roles } from '@/constants/roles'
import { ROUTES } from '@/constants/routes'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { useGetComplianceReport } from '@/hooks/useComplianceReports.js'
import { useCurrentUser } from '@/hooks/useCurrentUser.js'
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'


const withComplianceReportAccess = (WrappedComponent) => {
  function WithComplianceReportAccess(props) {
    const { compliancePeriod, complianceReportId } = useParams()
    const navigate = useNavigate()
    const { data: currentUser, isLoading: isUserLoading } = useCurrentUser()
    const { data: reportData, isLoading: isReportLoading } = useGetComplianceReport(currentUser?.organization?.organizationId, complianceReportId)
    
    useEffect(() => {
      if (!isUserLoading && !isReportLoading) {
        const isGovernmentUser = currentUser?.roles?.some(role => role.name === roles.government)
        const reportStatus = reportData?.report?.currentStatus?.status

        // Prevent Analysts from accessing Draft reports
        if (isGovernmentUser && reportStatus === COMPLIANCE_REPORT_STATUSES.DRAFT) {
          navigate(ROUTES.REPORTS, { replace: true })
        }
      }
    }, [isUserLoading, isReportLoading, currentUser, reportData, navigate])

    if (isUserLoading || isReportLoading) {
      return <div>Loading...</div>
    }

    return <WrappedComponent {...props} />
  }

  return WithComplianceReportAccess
}


export default withComplianceReportAccess