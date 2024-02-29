import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
import { DownloadButton } from '@/components/DownloadButton'
import { ROUTES, apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Box } from '@mui/material'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
// import { gridProps } from './options'
import OrganizationList from './components/OrganizationList'
import { Role } from '@/components/Role'
// import { statuses } from '@/constants/statuses'
import { transactionsColDefs } from './_schema'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { roles } from '@/constants/roles'

export const Transactions = () => {
  const { t } = useTranslation(['common', 'transactions'])
  const navigate = useNavigate()
  const location = useLocation()
  const apiService = useApiService()
  const gridRef = useRef()
  const { data: currentUser, hasRoles } = useCurrentUser()

  const [isDownloadingTransactions, setIsDownloadingTransactions] =
    useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')

  const [gridKey, setGridKey] = useState(`transactions-grid`)
  const handleGridKey = useCallback(() => {
    setGridKey(`transactions-grid`)
  }, [])
  const gridOptions = {
    overlayNoRowsTemplate: t('txn:noTxnsFound')
  }
  const getRowId = useCallback((params) => {
    return params.data.transaction_id + params.data.transaction_type
  }, [])

  const defaultSortModel = [{ field: 'create_date', direction: 'asc' }]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleRowClicked = useCallback((params) => {
    console.log(params)
    const transactionType = params.data.transaction_type
    console.log(transactionType)
    if (transactionType === 'Transfer') {
      navigate(
        ROUTES.TRANSFERS_VIEW.replace(':transferId', params.data.transaction_id)
      )
    } else if (
      transactionType === 'Administrative Adjustment' ||
      transactionType === 'Initiative Agreement'
    ) {
      navigate(
        ROUTES.TRANSACTIONS_VIEW.replace(
          ':transactionId',
          params.data.transaction_id
        )
      )
    }
  })

  const handleDownloadTransactions = async () => {
    setIsDownloadingTransactions(true)
    setAlertMessage('')
    try {
      await apiService.download('/transactions/export')
      isDownloadingTransactions(false)
    } catch (error) {
      console.error('Error downloading transactions information:', error)
      isDownloadingTransactions(false)
      setAlertMessage('Failed to download transactions information.')
      setAlertSeverity('error')
    }
  }

  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state])

  return (
    <>
      <div>
        {alertMessage && (
          <BCAlert data-test="alert-box" severity={alertSeverity}>
            {alertMessage}
          </BCAlert>
        )}
      </div>
      <BCTypography variant="h5" mb={2} color="primary">
        {t('txn:title')}
      </BCTypography>
      {/* <OrganizationList gridRef={gridRef} /> */}
      <Box display={'flex'} gap={2} mb={2}>
        <Role roles={['Supplier', 'Transfer']}>
          <BCButton
            variant="contained"
            size="small"
            color="primary"
            startIcon={
              <FontAwesomeIcon
                icon={faCirclePlus}
                className="small-icon"
                size="2x"
              />
            }
            onClick={() => navigate(ROUTES.TRANSFERS_ADD)}
          >
            <BCTypography variant="subtitle2">New transaction</BCTypography>
          </BCButton>
        </Role>
        <DownloadButton
          onDownload={handleDownloadTransactions}
          isDownloading={isDownloadingTransactions}
          label="Download as .xls"
          downloadLabel="Downloading Transaction Information..."
          dataTest="download-transactions-button"
        />
      </Box>
      <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
        <BCDataGridServer
          gridRef={gridRef}
          apiEndpoint={
            hasRoles(roles.supplier)
              ? apiRoutes.orgTransactions.replace(
                  ':orgID',
                  currentUser?.organization.organization_id
                )
              : apiRoutes.transactions
          }
          apiData={'transactions'}
          columnDefs={transactionsColDefs(t)}
          gridKey={gridKey}
          getRowId={getRowId}
          defaultSortModel={defaultSortModel}
          gridOptions={gridOptions}
          handleGridKey={handleGridKey}
          handleRowClicked={handleRowClicked}
          enableCopyButton={false}
        />
      </BCBox>
    </>
  )
}
