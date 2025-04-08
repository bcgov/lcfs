import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import {
  useGetChangeLog,
  useGetComplianceReport
} from '@/hooks/useComplianceReports'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import colors from '@/themes/base/colors'
import { Box } from '@mui/material'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { changelogColDefs, changelogCommonColDefs } from './_schema'

export const AllocationAgreementChangelog = () => {
  const { complianceReportId } = useParams()
  const { data: currentUser } = useCurrentUser()
  const { t } = useTranslation(['common', 'allocationAgreement', 'report'])
  const { data: currentReportData, isLoading } = useGetComplianceReport(
    currentUser?.organization?.organizationId,
    complianceReportId,
    {
      enabled: !!complianceReportId
    }
  )

  const { data: changelogData, isLoading: changelogDataLoading } =
    useGetChangeLog({
      complianceReportGroupUuid:
        currentReportData.report.complianceReportGroupUuid,
      dataType: 'allocation-agreements'
    })

  const getRowId = (params) => {
    return params.data.allocationAgreementId.toString()
  }

  const gridOptions = (highlight = true) => ({
    overlayNoRowsTemplate: t('allocationAgreement:noAllocationAgreementsFound'),
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
    <Box>
      {changelogData?.map((item, i) => {
        return (
          <Box mb={4} key={i}>
            <BCTypography variant="h6" color="primary" component="div" mb={2}>
              {item.nickname}
            </BCTypography>
            <Box>
              <BCGridViewer
                key={i}
                gridKey={`allocation-agreements-changelog-${i}`}
                columnDefs={
                  i === 0 || i + 1 === changelogData.length
                    ? changelogCommonColDefs(false)
                    : changelogColDefs()
                }
                queryData={{ data: { items: item.allocationAgreements } }}
                getRowId={getRowId}
                suppressPagination
                gridOptions={
                  i === 0 || i + 1 === changelogData.length
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
          </Box>
        )
      })}
    </Box>
  )
}
