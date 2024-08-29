import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import { useGetNotionalTransfers } from '@/hooks/useNotionalTransfer'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useParams } from 'react-router-dom'
import { formatNumberWithCommas as valueFormatter } from '@/utils/formatters'

export const NotionalTransferSummary = ({ data }) => {
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
    }),
    []
  )

  const columns = [
    { headerName: "Legal name of trading partner", field: "legalName" },
    { headerName: "Address for service", field: "addressForService" },
    { headerName: "Fuel category", field: "fuelCategory" },
    { headerName: "Received OR Transferred", field: "receivedOrTransferred" },
    { headerName: "Quantity (L)", field: "quantity", valueFormatter },
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
      <BCBox component="div" sx={{ height: '100%', width: '74rem' }}>
        <BCGridViewer
            gridKey={'notional-transfers'}
            getRowId={getRowId}
            columnDefs={columns}
            defaultColDef={defaultColDef}
            query={useGetNotionalTransfers}
            queryParams={{ complianceReportId }}
            dataKey={'notionalTransfers'}
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

NotionalTransferSummary.displayName = 'NotionalTransferSummary'