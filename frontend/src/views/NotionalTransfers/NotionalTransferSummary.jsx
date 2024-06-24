import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
import { DownloadButton } from '@/components/DownloadButton'
import { Role } from '@/components/Role'
import { roles } from '@/constants/roles'
import { ROUTES, apiRoutes } from '@/constants/routes'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useApiService } from '@/services/useApiService'
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Stack, Typography } from '@mui/material'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { notionalTransferColDefs } from './_schema'

export const NotionalTransfers = () => {
  const [isDownloadingNotionalTransfers, setIsDownloadingNotionalTransfers] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const [gridKey, setGridKey] = useState(`notional-transfers-grid`)
  const [searchParams] = useSearchParams()
  const highlightedId = searchParams.get('hid')

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

  const getRowId = (params) => {
    return params.data.notionalTransferId
  }

  const handleGridKey = () => {
    // setGridKey(`notional-transfers-grid-${uuid()}`)
    setGridKey(`notional-transfers-grid-<unique-id>`)
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
      <Typography variant="h5" color="primary" data-test="title">
        {t('NotionalTransfers')}
      </Typography>
      <Stack
        direction={{ md: 'column', lg: 'row' }}
        spacing={{ xs: 2, sm: 2, md: 3 }}
        useFlexGap
        flexWrap="wrap"
        mt={1}
        mb={2}
      >
        {userRoles.includes(roles.supplier) && (
          <BCButton
            variant="contained"
            size="small"
            color="primary"
            startIcon={
              <FontAwesomeIcon icon={faCirclePlus} className="small-icon" />
            }
            data-test="new-notional-transfer-btn"
            onClick={() => navigate(ROUTES.ADMIN_NOTIONAL_TRANSFERS_ADD)}
          >
            <Typography variant="subtitle2">
              {t('notionalTransfer:newNotionalTransferBtn')}
            </Typography>
          </BCButton>
        )}
        <DownloadButton
          onDownload={handleDownloadNotionalTransfers}
          isDownloading={isDownloadingNotionalTransfers}
          label={t('notionalTransfer:notionalTransferDownloadBtn')}
          downloadLabel={`${t('notionalTransfer:notionalTransferDownloadingMsg')}...`}
          dataTest="notional-transfer-download-btn"
        />
      </Stack>
      <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
        <BCDataGridServer
          className={'ag-theme-material'}
          gridRef={gridRef}
          apiEndpoint={apiRoutes.getNotionalTransfers}
          apiData={'notionalTransfers'}
          columnDefs={notionalTransferColDefs(t)}
          gridKey={gridKey}
          getRowId={getRowId}
          gridOptions={gridOptions}
          handleGridKey={handleGridKey}
          handleRowClicked={handleRowClicked}
          enableCopyButton={false}
          highlightedRowId={highlightedId}
        />
      </BCBox>
    </Grid2>
  )
}

NotionalTransfers.displayName = 'NotionalTransfers'
