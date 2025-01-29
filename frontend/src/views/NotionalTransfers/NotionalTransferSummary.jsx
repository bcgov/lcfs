import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import { useGetNotionalTransfers } from '@/hooks/useNotionalTransfer'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useParams } from 'react-router-dom'
import { formatNumberWithCommas as valueFormatter } from '@/utils/formatters'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses.js'
import { LinkRenderer } from '@/utils/grid/cellRenderers.jsx'

export const NotionalTransferSummary = ({ data, status }) => {
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const { complianceReportId } = useParams()

  const { t } = useTranslation(['common', 'notionalTransfers'])
  const location = useLocation()

  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state])

  const getRowId = (params) => params.data.notionalTransferId
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

  const columns = [
    {
      headerName: t('notionalTransfer:notionalTransferColLabels.legalName'),
      field: 'legalName',
      flex: 1,
      minWidth: 200
    },
    {
      headerName: t(
        'notionalTransfer:notionalTransferColLabels.addressForService'
      ),
      field: 'addressForService',
      flex: 1,
      minWidth: 200
    },
    {
      headerName: t('notionalTransfer:notionalTransferColLabels.fuelCategory'),
      field: 'fuelCategory'
    },
    {
      headerName: t(
        'notionalTransfer:notionalTransferColLabels.receivedOrTransferred'
      ),
      field: 'receivedOrTransferred'
    },
    {
      headerName: t('notionalTransfer:notionalTransferColLabels.quantity'),
      field: 'quantity',
      valueFormatter
    }
  ]

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
          gridKey={'notional-transfers'}
          getRowId={getRowId}
          columnDefs={columns}
          defaultColDef={defaultColDef}
          query={useGetNotionalTransfers}
          queryParams={{ complianceReportId }}
          dataKey="notionalTransfers"
          suppressPagination={data?.length <= 10}
          autoSizeStrategy={{
            type: 'fitCellContents',
            defaultMinWidth: 50,
            defaultMaxWidth: 600
          }}
          enableCellTextSelection
          ensureDomOrder
          handleRo
        />
      </BCBox>
    </Grid2>
  )
}

NotionalTransferSummary.displayName = 'NotionalTransferSummary'
