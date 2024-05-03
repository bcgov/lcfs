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
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Role } from '@/components/Role'
import { transactionsColDefs } from './_schema'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { roles, govRoles } from '@/constants/roles'
import { ORGANIZATION_STATUSES, TRANSFER_STATUSES } from '@/constants/statuses'
import OrganizationList from './components/OrganizationList'

export const Transactions = () => {
  const { t } = useTranslation(['common', 'transaction'])
  const navigate = useNavigate()
  const location = useLocation()
  const apiService = useApiService()
  const gridRef = useRef()
  const { data: currentUser, hasRoles } = useCurrentUser()

  const [searchParams] = useSearchParams();
  const highlightedId = searchParams.get('hid');

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
    return params.data.transactionType.toLowerCase() + '-' + params.data.transactionId
  }, [])

  const defaultSortModel = [{ field: 'createDate', direction: 'desc' }]
  const [selectedOrgId, setSelectedOrgId] = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleRowClicked = useCallback(
    (params) => {
      const { transactionId, transactionType, fromOrganization, status } =
        params.data
      const userOrgName = currentUser?.organization?.name

      // Define routes mapping for transaction types
      const routesMapping = {
        Transfer: {
          view: ROUTES.TRANSFERS_VIEW,
          edit: ROUTES.TRANSFERS_EDIT
        },
        'Administrative Adjustment': {
          view: ROUTES.TRANSACTIONS_VIEW // TODO Replace once we develop this feature
        },
        'Initiative Agreement': {
          view: ROUTES.TRANSACTIONS_VIEW // TODO Replace once we develop this feature
        }
      }

      // Determine if it's an edit scenario
      const isEditScenario =
        userOrgName === fromOrganization && status === TRANSFER_STATUSES.DRAFT
      const routeType = isEditScenario ? 'edit' : 'view'

      // Select the appropriate route based on the transaction type and scenario
      const routeTemplate = routesMapping[transactionType]?.[routeType]

      if (routeTemplate) {
        navigate(
          // replace any matching query params by chaining these replace methods
          routeTemplate
            .replace(':transactionId', transactionId)
            .replace(':transferId', transactionId)
        )
      } else {
        console.error('No route defined for this transaction type and scenario')
      }
    },
    [currentUser, navigate]
  )

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

  const apiEndpoint = useMemo(() => {
    if (selectedOrgId) {
      return `${apiRoutes.transactions}?organization_id=${selectedOrgId}`;
    }
    return apiRoutes.transactions;
  }, [selectedOrgId]);

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
      <Box display={'flex'} gap={2} mb={2}>
        {currentUser.organization?.orgStatus?.status ===
          ORGANIZATION_STATUSES.REGISTERED && (
          <Role roles={[roles.transfers]}>
            <BCButton
              id="new-transfer-button"
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
              <BCTypography variant="subtitle2">
                {t('txn:newTransferBtn')}
              </BCTypography>
            </BCButton>
          </Role>
        )}
        <DownloadButton
          onDownload={handleDownloadTransactions}
          isDownloading={isDownloadingTransactions}
          label="Download as .xls"
          downloadLabel="Downloading Transaction Information..."
          dataTest="download-transactions-button"
        />
      </Box>
      <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
        <Role roles={govRoles}>
          <OrganizationList onOrgChange={setSelectedOrgId} />
        </Role>
        <BCDataGridServer
          key={selectedOrgId || 'all'}
          gridRef={gridRef}
          apiEndpoint={apiEndpoint}
          apiData={'transactions'}
          columnDefs={transactionsColDefs(t)}
          gridKey={gridKey}
          getRowId={getRowId}
          defaultSortModel={defaultSortModel}
          gridOptions={gridOptions}
          handleGridKey={handleGridKey}
          handleRowClicked={handleRowClicked}
          enableCopyButton={false}
          highlightedRowId={highlightedId}
        />
      </BCBox>
    </>
  )
}
