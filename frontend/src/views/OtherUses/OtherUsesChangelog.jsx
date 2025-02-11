import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import { apiRoutes } from '@/constants/routes'
import { useGetComplianceReport } from '@/hooks/useComplianceReports'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import ROUTES from '@/routes/routes'
import colors from '@/themes/base/colors'
import { formatNumberWithCommas as valueFormatter } from '@/utils/formatters'
import { Box } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

export const OtherUsesChangelog = () => {
  const { complianceReportId, compliancePeriod } = useParams()
  const navigate = useNavigate()
  const { data: currentUser } = useCurrentUser()
  const { t } = useTranslation(['common', 'otherUses', 'report'])
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

  const gridOptions = {
    overlayNoRowsTemplate: t('otherUses:noOtherUsesFound'),
    autoSizeStrategy: {
      type: 'fitCellContents',
      defaultMinWidth: 50,
      defaultMaxWidth: 600
    },
    enableCellTextSelection: true, // enables text selection on the grid
    ensureDomOrder: true
  }

  const defaultColDef = {
    floatingFilter: false,
    filter: false
  }

  const commonColumnDef = [
    {
      headerName: t('otherUses:otherUsesColLabels.fuelType'),
      field: 'fuelType',
      valueGetter: (params) =>
        params.data.fuelType?.fuelType || params.data.fuelType,
      cellStyle: (params) => {
        if (params.data.actionType === 'UPDATE' && params.data.diff?.fuelType) {
          const style = { backgroundColor: colors.alerts.warning.background }
          if (params.data.updated) {
            style.textDecoration = 'line-through'
          }
          return style
        }
        if (params.data.actionType === 'DELETE') {
          return {
            textDecoration: 'line-through'
          }
        }
      }
    },
    {
      headerName: t('otherUses:otherUsesColLabels.fuelCategory'),
      field: 'fuelCategory',
      valueGetter: (params) =>
        params.data.fuelCategory?.category || params.data.fuelCategory,
      cellStyle: (params) => {
        if (
          params.data.actionType === 'UPDATE' &&
          params.data.diff?.fuelCategory
        ) {
          const style = { backgroundColor: colors.alerts.warning.background }
          if (params.data.updated) {
            style.textDecoration = 'line-through'
          }
          return style
        }
        if (params.data.actionType === 'DELETE') {
          return {
            textDecoration: 'line-through'
          }
        }
      }
    },
    {
      headerName: t('otherUses:otherUsesColLabels.provisionOfTheAct'),
      field: 'provisionOfTheAct',
      valueGetter: (params) =>
        params.data.provisionOfTheAct?.name || params.data.provisionOfTheAct,
      cellStyle: (params) => {
        if (
          params.data.actionType === 'UPDATE' &&
          params.data.diff?.provisionOfTheAct
        ) {
          const style = { backgroundColor: colors.alerts.warning.background }
          if (params.data.updated) {
            style.textDecoration = 'line-through'
          }
          return style
        }
        if (params.data.actionType === 'DELETE') {
          return {
            textDecoration: 'line-through'
          }
        }
      }
    },
    {
      headerName: t('otherUses:otherUsesColLabels.fuelCode'),
      field: 'fuelCode',
      valueGetter: (params) => params.data.endUseType?.type || 'Any',
      cellStyle: (params) => {
        if (params.data.actionType === 'UPDATE' && params.data.diff?.fuelCode) {
          const style = { backgroundColor: colors.alerts.warning.background }
          if (params.data.updated) {
            style.textDecoration = 'line-through'
          }
          return style
        }
        if (params.data.actionType === 'DELETE') {
          return {
            textDecoration: 'line-through'
          }
        }
      }
    },
    {
      headerName: t('otherUses:otherUsesColLabels.quantitySupplied'),
      field: 'quantitySupplied',
      valueFormatter,
      cellStyle: (params) => {
        if (
          params.data.actionType === 'UPDATE' &&
          params.data.diff?.quantitySupplied
        ) {
          const style = { backgroundColor: colors.alerts.warning.background }
          if (params.data.updated) {
            style.textDecoration = 'line-through'
          }
          return style
        }
        if (params.data.actionType === 'DELETE') {
          return {
            textDecoration: 'line-through'
          }
        }
      }
    },
    {
      headerName: t('otherUses:otherUsesColLabels.units'),
      field: 'units',
      cellStyle: (params) => {
        if (params.data.actionType === 'UPDATE' && params.data.diff?.units) {
          const style = { backgroundColor: colors.alerts.warning.background }
          if (params.data.updated) {
            style.textDecoration = 'line-through'
          }
          return style
        }
        if (params.data.actionType === 'DELETE') {
          return {
            textDecoration: 'line-through'
          }
        }
      }
    },
    {
      headerName: t('otherUses:otherUsesColLabels.ciOfFuel'),
      field: 'ciOfFuel',
      valueFormatter,
      cellStyle: (params) => {
        if (params.data.actionType === 'UPDATE' && params.data.diff?.ciOfFuel) {
          const style = { backgroundColor: colors.alerts.warning.background }
          if (params.data.updated) {
            style.textDecoration = 'line-through'
          }
          return style
        }
        if (params.data.actionType === 'DELETE') {
          return {
            textDecoration: 'line-through'
          }
        }
      }
    },
    {
      headerName: t('otherUses:otherUsesColLabels.expectedUse'),
      field: 'expectedUse',
      valueGetter: (params) =>
        params.data.expectedUse?.name || params.data.expectedUse,
      cellStyle: (params) => {
        if (
          params.data.actionType === 'UPDATE' &&
          params.data.diff?.expectedUse
        ) {
          const style = { backgroundColor: colors.alerts.warning.background }
          if (params.data.updated) {
            style.textDecoration = 'line-through'
          }
          return style
        }
        if (params.data.actionType === 'DELETE') {
          return {
            textDecoration: 'line-through'
          }
        }
      }
    },
    {
      headerName: t('otherUses:otherUsesColLabels.otherExpectedUse'),
      field: 'rationale',

      cellStyle: (params) => {
        if (
          params.data.actionType === 'UPDATE' &&
          params.data.diff?.rationale
        ) {
          const style = { backgroundColor: colors.alerts.warning.background }
          if (params.data.updated) {
            style.textDecoration = 'line-through'
          }
          return style
        }
        if (params.data.actionType === 'DELETE') {
          return {
            textDecoration: 'line-through'
          }
        }
      }
    }
  ]

  const changelogGridOptions = {
    ...gridOptions,
    getRowStyle: (params) => {
      if (params.data.actionType === 'DELETE') {
        return {
          backgroundColor: colors.alerts.error.background
        }
      }
      if (params.data.actionType === 'CREATE') {
        return {
          backgroundColor: colors.alerts.success.background
        }
      }
    }
  }
  const changelogColumnDef = [
    {
      field: 'groupUuid',
      hide: true,
      sort: 'desc',
      sortIndex: 1
    },
    { field: 'version', hide: true, sort: 'desc', sortIndex: 2 },
    {
      field: 'actionType',
      valueGetter: (params) => {
        if (params.data.actionType === 'UPDATE') {
          if (params.data.updated) {
            return 'Edited old'
          } else {
            return 'Edited new'
          }
        }
        if (params.data.actionType === 'DELETE') {
          return 'Deleted'
        }
        if (params.data.actionType === 'CREATE') {
          return 'Added'
        }
      },
      cellStyle: (params) => {
        if (params.data.actionType === 'UPDATE') {
          return { backgroundColor: colors.alerts.warning.background }
        }
      }
    },
    ...commonColumnDef
  ]

  const apiEndpoint = apiRoutes.getChangelog.replace(':selection', 'other-uses')

  if (isLoading) {
    return <Loading />
  }
  return (
    <div>
      <Box display="flex" alignItems={'center'} gap={1} mb={4}>
        <BCTypography variant="h5" color="primary" component="div">
          {t('otherUses:newOtherUsesTitle')}
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
          apiEndpoint={apiRoutes.getOtherUses}
          apiData={'otherUses'}
          apiParams={{ complianceReportId }}
          columnDefs={commonColumnDef}
          gridOptions={gridOptions}
          enableCopyButton={false}
          defaultColDef={defaultColDef}
        />
      </Box>
      <BCTypography variant="h6" color="primary" component="div" mb={2}>
        {latestAssessedReport.nickname}
      </BCTypography>
      <Box mb={4}>
        <BCDataGridServer
          className={'ag-theme-material'}
          apiEndpoint={apiEndpoint}
          apiData={'changelog'}
          apiParams={{ complianceReportId }}
          columnDefs={changelogColumnDef}
          gridOptions={changelogGridOptions}
          enableCopyButton={false}
          defaultColDef={defaultColDef}
        />
      </Box>
      <BCTypography variant="h6" color="primary" component="div" mb={2}>
        {compliancePeriod} {t('report:reportAssessed')}
      </BCTypography>
      <Box>
        <BCDataGridServer
          className={'ag-theme-material'}
          apiEndpoint={apiRoutes.getOtherUses}
          apiData={'otherUses'}
          apiParams={{ complianceReportId: latestAssessedReportId }}
          columnDefs={commonColumnDef}
          gridOptions={gridOptions}
          enableCopyButton={false}
          defaultColDef={defaultColDef}
        />
      </Box>
    </div>
  )
}
