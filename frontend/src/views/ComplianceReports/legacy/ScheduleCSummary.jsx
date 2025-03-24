import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useParams } from 'react-router-dom'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses.js'
import { LinkRenderer } from '@/utils/grid/cellRenderers.jsx'
import Grid2 from '@mui/material/Unstable_Grid2'
import { scheduleCSummaryColDefs } from '@/views/ComplianceReports/legacy/_schema.jsx'
import { BCGridViewer2 } from '@/components/BCDataGrid/BCGridViewer2.jsx'
import { defaultInitialPagination } from '@/constants/schedules.js'
import { useGetOtherUses } from '@/hooks/useOtherUses.js'

export const ScheduleCSummary = ({ data, status }) => {
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const { t } = useTranslation(['common', 'otherUses', 'legacy'])

  const { complianceReportId } = useParams()

  const location = useLocation()

  const [paginationOptions, setPaginationOptions] = useState(
    defaultInitialPagination
  )

  const queryData = useGetOtherUses(
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

  const defaultColDef = useMemo(
    () => ({
      floatingFilter: false,
      filter: false,
      cellRenderer:
        status === COMPLIANCE_REPORT_STATUSES.DRAFT ? LinkRenderer : undefined,
      cellRendererParams: {
        url: () => 'fuels-other-use'
      }
    }),
    [status]
  )

  const columns = useMemo(() => {
    return scheduleCSummaryColDefs(t)
  }, [t])

  const getRowId = (params) => params.data.otherUsesId.toString()

  return (
    <Grid2 className="other-uses-container" data-test="container" mx={-1}>
      <div>
        {alertMessage && (
          <BCAlert data-test="alert-box" severity={alertSeverity}>
            {alertMessage}
          </BCAlert>
        )}
      </div>
      <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
        <BCGridViewer2
          gridKey="other-uses"
          getRowId={getRowId}
          columnDefs={columns}
          defaultColDef={defaultColDef}
          queryData={queryData}
          dataKey="otherUses"
          suppressPagination={data?.length <= 10}
          initialPaginationOptions={defaultInitialPagination}
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

ScheduleCSummary.displayName = 'ScheduleCSummary'
