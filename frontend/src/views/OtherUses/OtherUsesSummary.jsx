import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses.js'
import { useGetOtherUses } from '@/hooks/useOtherUses'
import { LinkRenderer } from '@/utils/grid/cellRenderers.jsx'
import { otherUsesSummaryColDefs } from '@/views/OtherUses/_schema.jsx'
import Grid2 from '@mui/material/Grid2'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer.jsx'
import { defaultInitialPagination } from '@/constants/schedules.js'

export const OtherUsesSummary = ({ data, status }) => {
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')

  const [paginationOptions, setPaginationOptions] = useState(
    defaultInitialPagination
  )

  const { complianceReportId } = useParams()
  const location = useLocation()

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
        <BCGridViewer
          gridKey="other-uses"
          getRowId={getRowId}
          columnDefs={otherUsesSummaryColDefs}
          defaultColDef={defaultColDef}
          queryData={queryData}
          dataKey="otherUses"
          suppressPagination={data?.length <= 10}
          autoSizeStrategy={{
            type: 'fitCellContents',
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

OtherUsesSummary.displayName = 'OtherUsesSummary'
