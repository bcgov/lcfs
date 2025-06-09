import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses.js'
import { useGetNotionalTransfers } from '@/hooks/useNotionalTransfer'
import { LinkRenderer } from '@/utils/grid/cellRenderers.jsx'
import { notionalTransferSummaryColDefs } from '@/views/NotionalTransfers/_schema.jsx'
import Grid2 from '@mui/material/Grid2'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer.jsx'
import { defaultInitialPagination } from '@/constants/schedules.js'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useGetComplianceReport } from '@/hooks/useComplianceReports'
import { REPORT_SCHEDULES } from '@/constants/common'

export const NotionalTransferSummary = ({ data, status }) => {
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const { complianceReportId } = useParams()

  const [paginationOptions, setPaginationOptions] = useState(
    defaultInitialPagination
  )

  const location = useLocation()
  const { data: currentUser, isLoading: currentUserLoading } = useCurrentUser()
  const { data: complianceReport, isLoading: complianceReportLoading } =
    useGetComplianceReport(
      currentUser?.organization?.organizationId,
      complianceReportId,
      { enabled: !currentUserLoading }
    )

  const isEarlyIssuance =
    complianceReport?.report?.reportingFrequency === REPORT_SCHEDULES.QUARTERLY

  const queryData = useGetNotionalTransfers(
    { ...paginationOptions, complianceReportId },
    {
      cacheTime: 0,
      staleTime: 0
    }
  )

  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state])

  const getRowId = (params) => params.data.notionalTransferId.toString()
  const defaultColDef = useMemo(
    () => ({
      floatingFilter: false,
      filter: false,
      cellRenderer:
        status === COMPLIANCE_REPORT_STATUSES.DRAFT ? LinkRenderer : undefined,
      cellRendererParams: {
        url: () => 'notional-transfers'
      }
    }),
    [status]
  )

  return (
    <Grid2 className="notional-transfer-container" mx={-1}>
      <div>
        {alertMessage && (
          <BCAlert data-test="alert-box" severity={alertSeverity}>
            {alertMessage}
          </BCAlert>
        )}
      </div>
      <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
        <BCGridViewer
          gridKey="notional-transfers"
          getRowId={getRowId}
          columnDefs={notionalTransferSummaryColDefs(isEarlyIssuance)}
          defaultColDef={defaultColDef}
          queryData={queryData}
          dataKey="notionalTransfers"
          suppressPagination={data?.notionalTransfers?.length <= 10}
          autoSizeStrategy={{
            type: 'fitGridWidth',
            defaultMinWidth: 50,
            defaultMaxWidth: 600
          }}
          enableCellTextSelection
          paginationOptions={paginationOptions}
          onPaginationChange={(newPagination) =>
            setPaginationOptions((prev) => ({
              ...prev,
              ...newPagination
            }))
          }
        />
      </BCBox>
    </Grid2>
  )
}

NotionalTransferSummary.displayName = 'NotionalTransferSummary'
