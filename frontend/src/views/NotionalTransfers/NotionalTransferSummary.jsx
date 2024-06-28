import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
import { roles } from '@/constants/roles'
import { ROUTES, apiRoutes } from '@/constants/routes'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useApiService } from '@/services/useApiService'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { v4 as uuid } from 'uuid'

export const NotionalTransferSummary = ({ compliancePeriod }) => {
  const [isDownloadingNotionalTransfers, setIsDownloadingNotionalTransfers] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const [gridKey, setGridKey] = useState(`notional-transfers-grid`)
  const [searchParams] = useSearchParams()
  const highlightedId = searchParams.get('hid')
  const { complianceReportId } = useParams()

  const { data: currentUser } = useCurrentUser()

  const userRoles = currentUser?.roles?.map((role) => role.name) || []

  const isAuthorized = [
    roles.analyst,
    roles.compliance_manager,
    roles.director,
    roles.supplier
  ].some((role) => userRoles.includes(role))

  const gridRef = useRef()
  const apiService = useApiService()
  const { t } = useTranslation(['common', 'notionalTransfers'])
  const navigate = useNavigate()
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

  const handleRowClicked = (params) => {
    if (!isAuthorized) return
    navigate(
      ROUTES.ADMIN_NOTIONAL_TRANSFERS_VIEW.replace(
        ':notionalTransferID',
        params.data.notionalTransferId
      )
    )
  }

  const handleDownloadNotionalTransfers = async () => {
    setIsDownloadingNotionalTransfers(true)
    setAlertMessage('')
    try {
      await apiService.download(ROUTES.ADMIN_NOTIONAL_TRANSFERS + '/export')
      setIsDownloadingNotionalTransfers(false)
    } catch (error) {
      console.error('Error downloading notional transfer information:', error)
      setIsDownloadingNotionalTransfers(false)
      setAlertMessage(t('notionalTransfer:notionalTransferDownloadFailMsg'))
      setAlertSeverity('error')
    }
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
          handleRowClicked={handleRowClicked}
          enableCopyButton={false}
          highlightedRowId={highlightedId}
          suppressPagination={true}
        />
      </BCBox>
    </Grid2>
  )
}

NotionalTransferSummary.displayName = 'NotionalTransferSummary'
