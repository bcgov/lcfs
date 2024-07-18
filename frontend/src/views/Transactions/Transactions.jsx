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
import { Box, Grid } from '@mui/material'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Role } from '@/components/Role'
import {
  transactionsColDefs,
  defaultSortModel,
  filter_in_progress_transfers,
  filter_in_progress_org_transfers,
  filter_in_progress_initiative_agreements,
  filter_in_progress_admin_adjustments
} from './_schema'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { ORGANIZATION_STATUSES, TRANSACTION_STATUSES, TRANSFER_STATUSES } from '@/constants/statuses'
import { roles, govRoles } from '@/constants/roles'
import OrganizationList from './components/OrganizationList'

export const Transactions = () => {
  const { t } = useTranslation(['common', 'transaction'])
  const navigate = useNavigate()
  const location = useLocation()
  const apiService = useApiService()
  const gridRef = useRef()
  const { data: currentUser, hasRoles } = useCurrentUser()

  const [searchParams] = useSearchParams()
  const highlightedId = searchParams.get('hid')

  const filterType = searchParams.get('filter')
  const inProgressTransfers = filterType === 'in-progress-transfers'
  const inProgressOrgTransfers = filterType === 'in-progress-org-transfers'
  const inProgressInitiativeAgreements = filterType === 'in-progress-initiative-agreements'
  const inProgressAdminAdjustments = filterType === 'in-progress-admin-adjustments'

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

  const [selectedOrgId, setSelectedOrgId] = useState(null)

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
        'AdminAdjustment': {
          view: currentUser.isGovernmentUser ? ROUTES.ADMIN_ADJUSTMENT_VIEW : ROUTES.ORG_ADMIN_ADJUSTMENT_VIEW,
          edit: ROUTES.ADMIN_ADJUSTMENT_EDIT
        },
        'InitiativeAgreement': {
          view: currentUser.isGovernmentUser ? ROUTES.INITIATIVE_AGREEMENT_VIEW : ROUTES.ORG_INITIATIVE_AGREEMENT_VIEW,
          edit: ROUTES.INITIATIVE_AGREEMENT_EDIT
        }
      }

      // Determine if it's an edit scenario
      const isEditScenario = (
        (userOrgName === fromOrganization && status === TRANSFER_STATUSES.DRAFT) ||
        (!fromOrganization && (
          status === TRANSACTION_STATUSES.DRAFT
        ))
      )

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

  // Determine the appropriate API endpoint
  const getApiEndpoint = useCallback(() => {
    if (hasRoles(roles.supplier)) {
      return apiRoutes.orgTransactions
    } else if (selectedOrgId) {
      return apiRoutes.filteredTransactionsByOrg.replace(':orgID', selectedOrgId)
    }
    return apiRoutes.transactions
  }, [selectedOrgId, currentUser, hasRoles])

  // Determine the appropriate export API endpoint
  const getExportApiEndpoint = useCallback(() => {
    if (hasRoles(roles.supplier)) {
      return apiRoutes.exportOrgTransactions
    } else if (selectedOrgId) {
      return apiRoutes.exportFilteredTransactionsByOrg.replace(':orgID', selectedOrgId)
    }
    return apiRoutes.exportTransactions
  }, [selectedOrgId, currentUser, hasRoles])

  const handleDownloadTransactions = async () => {
    setIsDownloadingTransactions(true)
    setAlertMessage('')
    try {
      const endpoint = getExportApiEndpoint()
      await apiService.download(`${endpoint}`)
      setIsDownloadingTransactions(false)
    } catch (error) {
      console.error('Error downloading transactions information:', error)
      setIsDownloadingTransactions(false)
      setAlertMessage('Failed to download transactions information.')
      setAlertSeverity('error')
    }
  }

  const apiEndpoint = useMemo(() => getApiEndpoint(), [getApiEndpoint])

  const filterModel = useMemo(() => {
    if (inProgressTransfers) return filter_in_progress_transfers
    if (inProgressOrgTransfers) return filter_in_progress_org_transfers
    if (inProgressInitiativeAgreements) return filter_in_progress_initiative_agreements
    if (inProgressAdminAdjustments) return filter_in_progress_admin_adjustments
    return []
  }, [inProgressTransfers, inProgressOrgTransfers, inProgressInitiativeAgreements, inProgressAdminAdjustments])

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
      <Grid container spacing={2}>
        <Grid item xs={12} lg={5}>
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
          <Role roles={[roles.analyst]}>
            <BCButton
              id="new-transaction-button"
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
              onClick={() => navigate(ROUTES.TRANSACTIONS_ADD)}
            >
              <BCTypography variant="subtitle2">
                {t('txn:newTransactionBtn')}
              </BCTypography>
            </BCButton>
          </Role>
          <DownloadButton
            onDownload={handleDownloadTransactions}
            isDownloading={isDownloadingTransactions}
            label={t('txn:downloadAsExcel')}
            downloadLabel={t('txn:downloadingTxnInfo')}
            dataTest="download-transactions-button"
          />
        </Box>
        </Grid>
        <Grid item xs={12} lg={7} sx={{ 
            display: 'flex', 
            flexDirection: 'column',
            justifyContent: { xs: 'flex-start', lg: 'flex-end' },
            alignItems: { lg: 'flex-end' }
        }}>
          <Role roles={govRoles}>
            <OrganizationList onOrgChange={setSelectedOrgId} />
          </Role>
        </Grid>
      </Grid>
      <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
        <BCDataGridServer
          key={selectedOrgId || 'all'}
          gridRef={gridRef}
          apiEndpoint={apiEndpoint}
          apiData={'transactions'}
          columnDefs={transactionsColDefs(t)}
          gridKey={gridKey}
          getRowId={getRowId}
          defaultSortModel={defaultSortModel}
          // defaultFilterModel={filterModel}
          gridOptions={gridOptions}
          handleGridKey={handleGridKey}
          handleRowClicked={handleRowClicked}
          enableCopyButton={false}
          highlightedRowId={highlightedId}
          defaultFilterModel={location.state?.filters}
        />
      </BCBox>
    </>
  )
}
