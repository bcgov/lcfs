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

export const FuelExportChangelog = ({ canEdit }) => {
  const { complianceReportId, compliancePeriod } = useParams()
  const { data: currentUser } = useCurrentUser()
  const { t } = useTranslation(['common', 'fuelExport', 'report'])
  const { data: currentReportData, isLoading } = useGetComplianceReport(
    currentUser?.organization?.organizationId,
    complianceReportId,
    {
      enabled: !!complianceReportId
    }
  )

  // Replace the current version lookup with a reducer using 'version' for the most recent assessed/reassessed report
  const latestAssessedReport = currentReportData?.chain?.reduce(
    (latest, report) => {
      if (
        report.currentStatus.status === 'Assessed' ||
        report.currentStatus.status === 'Reassessed'
      ) {
        return !latest || report.version > latest.version ? report : latest
      }
      return latest
    },
    null
  )

  const latestAssessedReportId = latestAssessedReport?.complianceReportId

  const apiEndpoint = apiRoutes.getChangelog.replace(
    ':selection',
    'fuel-exports'
  )

  if (isLoading) {
    return <Loading />
  }

  return (
    <div>
      <BCTypography variant="h6" color="primary" component="div" mb={2}>
        {!canEdit && currentReportData.report.nickname}
        {canEdit && t('common:changelogCurrentState')}
      </BCTypography>
      <Box mb={4}>
        <BCDataGridServer
          className={'ag-theme-material'}
          apiEndpoint={apiEndpoint}
          apiData={'changelog'}
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
          className={'ag-theme-material'}
          apiEndpoint={apiRoutes.getAllFuelExports}
          apiData={'fuelExports'}
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
