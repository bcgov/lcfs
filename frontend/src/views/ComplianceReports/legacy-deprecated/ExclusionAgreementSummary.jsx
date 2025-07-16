import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import Grid2 from '@mui/material/Grid2'
import { formatNumberWithCommas as valueFormatter } from '@/utils/formatters'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useParams } from 'react-router-dom'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses.js'
import { LinkRenderer } from '@/utils/grid/cellRenderers.jsx'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer.jsx'
import { defaultInitialPagination } from '@/constants/schedules.js'
import { useGetAllocationAgreements } from '@/hooks/useAllocationAgreement.js'
import { exclusionSummaryColDefs } from './_schema.jsx'

export const ExclusionAgreementSummary = ({ data, status }) => {
  const gridRef = useRef()
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const { complianceReportId: reportIdString } = useParams()

  const [paginationOptions, setPaginationOptions] = useState(
    defaultInitialPagination
  )

  const { t } = useTranslation(['common', 'exclusionAgreement', 'legacy'])
  const location = useLocation()

  const complianceReportId = parseInt(reportIdString)

  const queryData = useGetAllocationAgreements(
    complianceReportId,
    paginationOptions,
    {
      cacheTime: 0,
      staleTime: 0,
      enabled: !isNaN(complianceReportId)
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
        url: () => 'exclusion-agreements'
      }
    }),
    [status]
  )

  const columns = useMemo(() => exclusionSummaryColDefs(t), [t])

  const getRowId = (params) => {
    return params.data.allocationAgreementId.toString()
  }

  return (
    <Grid2
      className="exclusion-agreement-container"
      data-test="exclusion-agreement-summary"
      mx={-1}
    >
      <div>
        {alertMessage && (
          <BCAlert data-test="alert-box" severity={alertSeverity}>
            {alertMessage}
          </BCAlert>
        )}
      </div>
      <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
        <BCGridViewer
          gridKey="exclusion-agreements"
          getRowId={getRowId}
          columnDefs={columns}
          gridRef={gridRef}
          defaultColDef={defaultColDef}
          queryData={queryData}
          dataKey="allocationAgreements"
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

ExclusionAgreementSummary.displayName = 'ExclusionAgreementSummary'
