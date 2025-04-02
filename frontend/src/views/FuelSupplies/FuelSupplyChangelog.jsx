import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import { apiRoutes } from '@/constants/routes'
import { useGetComplianceReport } from '@/hooks/useComplianceReports'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import ROUTES from '@/routes/routes'
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
import { useGetFuelSupplyChangeLog } from '@/hooks/useFuelSupply'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import { useMemo } from 'react'

export const FuelSupplyChangelog = ({ canEdit }) => {
  const { complianceReportId, compliancePeriod } = useParams()
  const { data: currentUser } = useCurrentUser()
  const { t } = useTranslation(['common', 'fuelSupply', 'report'])
  const { data: currentReportData, isLoading } = useGetComplianceReport(
    currentUser?.organization?.organizationId,
    complianceReportId,
    {
      enabled: !!complianceReportId
    }
  )
  const { data: changelogData } = useGetFuelSupplyChangeLog({
    complianceReportId
  })

  // Replace the current version lookup with a reducer using 'version' for the most recent assessed/reassessed report
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

  const apiEndpoint = apiRoutes.getChangelog.replace(
    ':selection',
    'fuel-supply'
  )

  const getRowId = (params) => {
    console.log('getRowId', params)
    return params.data.fuel_supply_id.toString()
  }

  const gridOptions = useMemo(
    () => ({
      overlayNoRowsTemplate: t(
        'allocationAgreement:noAllocationAgreementsFound'
      ),
      autoSizeStrategy: {
        type: 'fitCellContents',
        defaultMinWidth: 50,
        defaultMaxWidth: 600
      },
      enableCellTextSelection: true, // enables text selection on the grid
      ensureDomOrder: true
    }),
    [t]
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
        {/* <BCDataGridServer
          className="ag-theme-material"
          apiEndpoint={apiEndpoint}
          apiData="changelog"
          apiParams={{ complianceReportId }}
          columnDefs={changelogColDefs}
          gridOptions={changelogGridOptions}
          enableCopyButton={false}
          defaultColDef={changelogDefaultColDefs}
        /> */}
        {changelogData?.changelog.map((item, i) => {
          return (
            <>
              <BCTypography variant="h6" color="primary" component="div" mb={2}>
                {item.label}
              </BCTypography>
              <Box>
                <BCGridViewer
                  key={i}
                  gridKey={`fuel-supply-changelog-${i}`}
                  columnDefs={changelogColDefs}
                  queryData={{ data: { items: item.data } }}
                  getRowId={getRowId}
                  suppressPagination
                  gridOptions={gridOptions}
                />
              </Box>
            </>
          )
        })}
      </Box>
      {/* <BCTypography variant="h6" color="primary" component="div" mb={2}>
        {compliancePeriod} {t('report:reportAssessed')}
      </BCTypography>
      <Box>
        <BCDataGridServer
          className="ag-theme-material"
          apiEndpoint={apiRoutes.getAllFuelSupplies}
          apiData="fuelSupplies"
          apiParams={{ complianceReportId: latestAssessedReportId }}
          columnDefs={changelogCommonColDefs}
          gridOptions={changelogCommonGridOptions}
          enableCopyButton={false}
          defaultColDef={changelogDefaultColDefs}
        />
      </Box> */}
    </div>
  )
}
