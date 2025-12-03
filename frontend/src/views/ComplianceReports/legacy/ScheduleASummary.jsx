import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import { useGetNotionalTransfers } from '@/hooks/useNotionalTransfer'
import Grid2 from '@mui/material/Grid2'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useParams } from 'react-router-dom'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { LinkRenderer } from '@/utils/grid/cellRenderers.jsx'
import { scheduleASummaryColDefs } from '@/views/ComplianceReports/legacy/_schema.jsx'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer.jsx'
import { defaultInitialPagination } from '@/constants/schedules'

export const ScheduleASummary = ({ data, status }) => {
  const ref = useRef(null)

  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const { complianceReportId } = useParams()

  const [paginationOptions, setPaginationOptions] = useState(
    defaultInitialPagination
  )

  const { t } = useTranslation(['common', 'notionalTransfers', 'legacy'])
  const location = useLocation()

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

  const columns = useMemo(() => {
    return scheduleASummaryColDefs(t)
  }, [t])

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
          ref={ref}
          gridKey="notional-transfers"
          columnDefs={columns}
          getRowId={getRowId}
          defaultColDef={defaultColDef}
          queryData={queryData}
          dataKey="notionalTransfers"
          suppressPagination={data?.length <= 10}
          paginationOptions={paginationOptions}
          onPaginationChange={(newPagination) =>
            setPaginationOptions((prev) => ({
              ...prev,
              ...newPagination
            }))
          }
          autoSizeStrategy={{
            type: 'fitCellContents',
            defaultMinWidth: 50,
            defaultMaxWidth: 600
          }}
          enableCellTextSelection
        />
      </BCBox>
    </Grid2>
  )
}

ScheduleASummary.displayName = 'ScheduleASummary'
