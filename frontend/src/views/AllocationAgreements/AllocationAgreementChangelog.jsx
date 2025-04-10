import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import { apiRoutes } from '@/constants/routes'
import { useGetComplianceReport } from '@/hooks/useComplianceReports'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Box } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import {
  changelogColDefs,
  changelogCommonColDefs,
  changelogCommonGridOptions,
  changelogDefaultColDefs,
  changelogGridOptions
} from './_schema'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses.js'

export const AllocationAgreementChangelog = ({ canEdit }) => {
  const { complianceReportId, compliancePeriod } = useParams()
  const { data: currentUser, isLoading: isCurrentUserLoading } =
    useCurrentUser()
  const { t } = useTranslation(['common', 'allocationAgreement', 'report'])
  const { data: currentReportData, isLoading } = useGetComplianceReport(
    currentUser?.organization?.organizationId,
    complianceReportId,
    {
      enabled: !!complianceReportId && !isCurrentUserLoading
    }
  )

  const latestAssessedReport = currentReportData?.chain?.reduce(
    (latest, report) => {
      if (report.currentStatus.status === COMPLIANCE_REPORT_STATUSES.ASSESSED) {
        return !latest || report.version > latest.version ? report : latest
      }
      return latest
    },
    null
  )

  const latestAssessedReportId = latestAssessedReport?.complianceReportId

  if (isLoading) {
    return <Loading />
  }

  const apiEndpoint = apiRoutes.getChangelog.replace(
    ':selection',
    'allocation-agreements'
  )

  return (
    <div>
      <BCTypography variant="h6" color="primary" component="div" mb={2}>
        {!canEdit && currentReportData.report.nickname}
        {canEdit && t('common:changelogCurrentState')}
      </BCTypography>
      <Box mb={4}>
        <BCDataGridServer
          className="ag-theme-material"
          apiEndpoint={apiRoutes.getAllocationAgreements}
          apiData="allocationAgreements"
          apiParams={{ complianceReportId }}
          columnDefs={changelogCommonColDefs}
          gridOptions={changelogCommonGridOptions}
          enableCopyButton={false}
          defaultColDef={changelogDefaultColDefs}
        />
      </Box>
      <BCTypography variant="h6" color="primary" component="div" mb={2}>
        {latestAssessedReport
          ? latestAssessedReport.nickname
          : 'Default Report'}
      </BCTypography>
      <Box mb={4}>
        <BCDataGridServer
          className={'ag-theme-material'}
          apiEndpoint={apiEndpoint}
          apiData="changelog"
          apiParams={{ complianceReportId }}
          columnDefs={changelogColDefs}
          gridOptions={changelogGridOptions}
          enableCopyButton={false}
          defaultColDef={changelogDefaultColDefs}
        />
      </Box>
      <BCTypography variant="h6" color="primary" component="div" mb={2}>
        {compliancePeriod} {t('report:reportAssessed')}
      </BCTypography>
      <Box>
        <BCDataGridServer
          className="ag-theme-material"
          apiEndpoint={apiRoutes.getAllocationAgreements}
          apiData="allocationAgreements"
          apiParams={{ complianceReportId: latestAssessedReportId }}
          columnDefs={changelogCommonColDefs}
          gridOptions={changelogCommonGridOptions}
          enableCopyButton={false}
          defaultColDef={changelogDefaultColDefs}
        />
      </Box>
    </div>
  )
}
