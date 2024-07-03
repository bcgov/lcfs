import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
import { apiRoutes } from '@/constants/routes'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useParams } from 'react-router-dom'
import { v4 as uuid } from 'uuid'

export const NotionalTransferSummary = ({ data }) => {
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const [gridKey, setGridKey] = useState(`notional-transfers-grid`)
  const { complianceReportId } = useParams()


  const gridRef = useRef()
  const { t } = useTranslation(['common', 'notionalTransfers'])
  const location = useLocation()

  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state])

  const gridOptions = useMemo(() => ({
    overlayNoRowsTemplate: t('notionalTransfer:noNotionalTransfersFound'),
    autoSizeStrategy: {
      type: 'fitCellContents',
      defaultMinWidth: 50,
      defaultMaxWidth: 600
    }
  }))

  const columns = [
    { headerName: "Legal name of trading partner", field: "legalName", floatingFilter: false },
    { headerName: "Address for service", field: "addressForService", floatingFilter: false },
    { headerName: "Fuel category", field: "fuelCategory", floatingFilter: false },
    { headerName: "Received OR Transferred", field: "receivedOrTransferred", floatingFilter: false },
    { headerName: "Quantity (L)", field: "quantity", floatingFilter: false },
];

  const getRowId = (params) => {
    return params.data.notionalTransferId
  }

  const handleGridKey = () => {
    setGridKey(`notional-transfers-grid-${uuid()}`)
  }

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
        <BCDataGridServer
          className={'ag-theme-material'}
          gridRef={gridRef}
          apiEndpoint={apiRoutes.getNotionalTransfers}
          apiData={'notionalTransfers'}
          apiParams={{complianceReportId}}
          columnDefs={columns}
          gridKey={gridKey}
          getRowId={getRowId}
          gridOptions={gridOptions}
          handleGridKey={handleGridKey}
          enableCopyButton={false}
          suppressPagination={data?.length <= 10}
        />
      </BCBox>
    </Grid2>
  )
}

NotionalTransferSummary.displayName = 'NotionalTransferSummary'
