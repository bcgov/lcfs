import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import { apiRoutes } from '@/constants/routes'
import { useGetComplianceReport } from '@/hooks/useComplianceReports'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import ROUTES from '@/routes/routes'
import { Box } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import {
  changelogColDefs,
  changelogCommonColDefs,
  changelogCommonGridOptions,
  changelogDefaultColDefs,
  changelogGridOptions
} from './_schema'

export const AllocationAgreementChangelog = () => {
  const { complianceReportId, compliancePeriod } = useParams()
  const navigate = useNavigate()
  const { data: currentUser } = useCurrentUser()
  const { t } = useTranslation(['common', 'allocationAgreement', 'report'])
  const { data: currentReportData, isLoading } = useGetComplianceReport(
    currentUser?.organization?.organizationId,
    complianceReportId,
    {
      enabled: !!complianceReportId
    }
  )

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
    'allocation-agreements'
  )

  if (isLoading) {
    return <Loading />
  }

  return (
    <div>
      <Box display="flex" alignItems={'center'} gap={1} mb={4}>
        <BCTypography variant="h5" color="primary" component="div">
          {t('allocationAgreement:allocationAgreementTitle')}
        </BCTypography>{' '}
        |{' '}
        <BCTypography
          variant="body2"
          color="primary"
          component="div"
          sx={{
            textDecoration: 'underline',
            cursor: 'pointer'
          }}
          onClick={() =>
            navigate(
              ROUTES.REPORTS.VIEW.replace(
                ':compliancePeriod',
                compliancePeriod
              ).replace(':complianceReportId', complianceReportId)
            )
          }
        >
          {t('common:exitChangeLog')}
        </BCTypography>
      </Box>
      <BCTypography variant="h6" color="primary" component="div" mb={2}>
        {t('common:changelogCurrentState')}
      </BCTypography>
      <Box mb={4}>
        <BCDataGridServer
          className={'ag-theme-material'}
          apiEndpoint={apiRoutes.getAllAllocationAgreements}
          apiData={'allocationAgreements'}
          apiParams={{ complianceReportId }}
          columnDefs={changelogCommonColDefs}
          gridOptions={changelogCommonGridOptions}
          enableCopyButton={false}
          defaultColDef={changelogDefaultColDefs}
        />
      </Box>
      <BCTypography variant="h6" color="primary" component="div" mb={2}>
      {latestAssessedReport ? latestAssessedReport.nickname : 'Default Report'}
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
          apiEndpoint={apiRoutes.getAllAllocationAgreements}
          apiData={'allocationAgreements'}
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