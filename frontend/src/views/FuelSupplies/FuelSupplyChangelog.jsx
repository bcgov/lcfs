import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import { useGetComplianceReport } from '@/hooks/useComplianceReports'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useGetFuelSupplyChangeLog } from '@/hooks/useFuelSupply'
import colors from '@/themes/base/colors'
import { Box } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { changelogColDefs, changelogCommonColDefs } from './_schema'

export const FuelSupplyChangelog = () => {
  const { complianceReportId } = useParams()
  const { data: currentUser } = useCurrentUser()
  const { t } = useTranslation(['common', 'fuelSupply', 'report'])
  const { data: currentReportData, isLoading } = useGetComplianceReport(
    currentUser?.organization?.organizationId,
    complianceReportId,
    {
      enabled: !!complianceReportId
    }
  )

  const { data: changelogData, isLoading: changelogDataLoading } =
    useGetFuelSupplyChangeLog({
      complianceReportGroupUuid:
        currentReportData.report.complianceReportGroupUuid
    })

  const getRowId = (params) => {
    return params.data.fuelSupplyId.toString()
  }

  const gridOptions = (highlight = true) => ({
    overlayNoRowsTemplate: t('fuelSupply:noFuelSuppliesFound'),
    autoSizeStrategy: {
      type: 'fitCellContents',
      defaultMinWidth: 50,
      defaultMaxWidth: 600
    },
    enableCellTextSelection: true,
    ensureDomOrder: true,
    getRowStyle: (params) => {
      if (!highlight) return
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
  })

  if (isLoading || changelogDataLoading) {
    return <Loading />
  }

  return (
    <Box mb={4}>
      <BCTypography variant="h6" color="primary" component="div" mb={2}>
        Current state
      </BCTypography>
      <Box>
        <BCGridViewer
          gridKey={`fuel-supply-current`}
          columnDefs={changelogCommonColDefs(false)}
          queryData={{ data: { items: changelogData[0].fuelSupplies } }}
          getRowId={getRowId}
          suppressPagination
          gridOptions={gridOptions(false)}
          defaultColDef={{
            floatingFilter: false,
            filter: false,
            sortable: false
          }}
        />
      </Box>
      {changelogData?.map((item, i) => {
        return (
          <>
            <BCTypography variant="h6" color="primary" component="div" mb={2}>
              {item.label}
            </BCTypography>
            <Box>
              <BCGridViewer
                key={i}
                gridKey={`fuel-supply-changelog-${i}`}
                columnDefs={
                  i + 1 === changelogData.length
                    ? changelogCommonColDefs(false)
                    : changelogColDefs()
                }
                queryData={{ data: { items: item.fuelSupplies } }}
                getRowId={getRowId}
                suppressPagination
                gridOptions={
                  i + 1 === changelogData.length
                    ? gridOptions(false)
                    : gridOptions()
                }
                defaultColDef={{
                  floatingFilter: false,
                  filter: false,
                  sortable: false
                }}
              />
            </Box>
          </>
        )
      })}
    </Box>
  )
}
