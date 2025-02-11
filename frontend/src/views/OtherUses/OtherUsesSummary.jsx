import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import { useGetOtherUses } from '@/hooks/useOtherUses'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import {
  decimalFormatter,
  formatNumberWithCommas as valueFormatter
} from '@/utils/formatters'
import { useTranslation } from 'react-i18next'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses.js'
import { LinkRenderer } from '@/utils/grid/cellRenderers.jsx'
import { finalSupplyEquipmentSummaryColDefs } from '@/views/FinalSupplyEquipments/_schema.jsx'
import { otherUsesSummaryColDefs } from '@/views/OtherUses/_schema.jsx'

export const OtherUsesSummary = ({ data, status }) => {
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const { t } = useTranslation(['common', 'otherUses'])

  const { complianceReportId } = useParams()

  const location = useLocation()

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
    return otherUsesSummaryColDefs(t)
  }, [t])

  const getRowId = (params) => params.data.otherUsesId

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
          columnDefs={columns}
          defaultColDef={defaultColDef}
          query={useGetOtherUses}
          queryParams={{ complianceReportId }}
          dataKey="otherUses"
          suppressPagination={data?.length <= 10}
          autoSizeStrategy={{
            type: 'fitCellContents',
            defaultMinWidth: 50,
            defaultMaxWidth: 600
          }}
          enableCellTextSelection
          ensureDomOrder
        />
      </BCBox>
    </Grid2>
  )
}

OtherUsesSummary.displayName = 'OtherUsesSummary'
