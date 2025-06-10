import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import Grid2 from '@mui/material/Grid2'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useParams } from 'react-router-dom'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses.js'
import { LinkRenderer } from '@/utils/grid/cellRenderers.jsx'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer.jsx'
import { defaultInitialPagination } from '@/constants/schedules.js'
import { useGetAllAllocationAgreements } from '@/hooks/useAllocationAgreement.js'
import { allocationAgreementSummaryColDef } from './_schema.jsx'

export const AllocationAgreementSummary = ({
  data,
  status,
  isEarlyIssuance
}) => {
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const { complianceReportId } = useParams()

  const [paginationOptions, setPaginationOptions] = useState(
    defaultInitialPagination
  )

  const gridRef = useRef()
  const { t } = useTranslation(['common', 'allocationAgreement'])
  const location = useLocation()

  const queryData = useGetAllAllocationAgreements(
    complianceReportId,
    paginationOptions,
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

  const defaultColDef = useMemo(
    () => ({
      floatingFilter: false,
      filter: false,
      cellRenderer:
        status === COMPLIANCE_REPORT_STATUSES.DRAFT ? LinkRenderer : undefined,
      cellRendererParams: {
        url: () => 'allocation-agreements'
      }
    }),
    [status]
  )

  const columns = useMemo(
    () => allocationAgreementSummaryColDef(isEarlyIssuance),
    [isEarlyIssuance]
  )

  const getRowId = (params) => {
    return params.data.allocationAgreementId.toString()
  }

  return (
    <Grid2 className="allocation-agreement-container" mx={-1}>
      <div>
        {alertMessage && (
          <BCAlert data-test="alert-box" severity={alertSeverity}>
            {alertMessage}
          </BCAlert>
        )}
      </div>
      <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
        <BCGridViewer
          gridKey="allocation-agreements"
          gridRef={gridRef}
          columnDefs={columns}
          queryData={queryData}
          dataKey="allocationAgreements"
          getRowId={getRowId}
          gridOptions={gridOptions}
          enableCopyButton={false}
          defaultColDef={defaultColDef}
          suppressPagination={data.allocationAgreements.length <= 10}
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

AllocationAgreementSummary.displayName = 'AllocationAgreementSummary'
