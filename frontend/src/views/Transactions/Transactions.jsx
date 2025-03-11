import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { DownloadButton } from '@/components/DownloadButton'
import { ClearFiltersButton } from '@/components/ClearFiltersButton'
import { apiRoutes, ROUTES } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Box, Grid } from '@mui/material'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Role } from '@/components/Role'
import { defaultSortModel, transactionsColDefs } from './_schema'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  ORGANIZATION_STATUSES,
  TRANSACTION_STATUSES,
  TRANSFER_STATUSES
} from '@/constants/statuses'
import { govRoles, roles } from '@/constants/roles'
import OrganizationList from './components/OrganizationList'
import Loading from '@/components/Loading'
import { ConditionalLinkRenderer } from '@/utils/grid/cellRenderers.jsx'
import { BCGridViewer2 } from '@/components/BCDataGrid/BCGridViewer2'
import { useGetTransactionList } from '@/hooks/useTransactions'

const initialPaginationOptions = {
  page: 1,
  size: 10,
  sortOrders: defaultSortModel,
  filters: []
}

export const Transactions = () => {
  const { t } = useTranslation(['common', 'transaction'])
  const navigate = useNavigate()
  const location = useLocation()
  const apiService = useApiService()
  const gridRef = useRef()
  const downloadButtonRef = useRef(null)
  const { data: currentUser, hasAnyRole, hasRoles } = useCurrentUser()

  const [searchParams] = useSearchParams()
  const highlightedId = searchParams.get('hid')

  const [isDownloadingTransactions, setIsDownloadingTransactions] =
    useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')

  const [paginationOptions, setPaginationOptions] = useState(
    initialPaginationOptions
  )
  const [selectedOrgId, setSelectedOrgId] = useState(null)

  const queryData = useGetTransactionList(
    {
      ...paginationOptions,
      selectedOrgId
    },
    {
      cacheTime: 0,
      staleTime: 0
    }
  )

  const getRowId = useCallback((params) => {
    return (
      params.data.transactionType.toLowerCase() +
      '-' +
      params.data.transactionId
    )
  }, [])

  const shouldRenderLink = (props) => {
    return (
      props.data.transactionType !== 'ComplianceReport' ||
      hasAnyRole(
        roles.government,
        roles.signing_authority,
        roles.compliance_reporting
      )
    )
  }

  const defaultColDef = useMemo(
    () => ({
      cellRenderer: ConditionalLinkRenderer(shouldRenderLink),
      cellRendererParams: {
        isAbsolute: true,
        url: (
          data // Based on the user Type (BCeID or IDIR) navigate to specific view
        ) => {
          const {
            transactionId,
            transactionType,
            fromOrganization,
            status,
            compliancePeriod
          } = data.data
          const userOrgName = currentUser?.organization?.name

          // Define routes mapping for transaction types
          const routesMapping = {
            Transfer: {
              view: ROUTES.TRANSFERS_VIEW,
              edit: ROUTES.TRANSFERS_EDIT
            },
            AdminAdjustment: {
              view: currentUser.isGovernmentUser
                ? ROUTES.ADMIN_ADJUSTMENT_VIEW
                : ROUTES.ORG_ADMIN_ADJUSTMENT_VIEW,
              edit: ROUTES.ADMIN_ADJUSTMENT_EDIT
            },
            InitiativeAgreement: {
              view: currentUser.isGovernmentUser
                ? ROUTES.INITIATIVE_AGREEMENT_VIEW
                : ROUTES.ORG_INITIATIVE_AGREEMENT_VIEW,
              edit: ROUTES.INITIATIVE_AGREEMENT_EDIT
            },
            ComplianceReport: {
              view: ROUTES.REPORTS_VIEW,
              edit: ROUTES.INITIATIVE_AGREEMENT_EDIT
            }
          }

          // Determine if it's an edit scenario
          const isEditScenario =
            (userOrgName === fromOrganization &&
              status === TRANSFER_STATUSES.DRAFT) ||
            (!fromOrganization && status === TRANSACTION_STATUSES.DRAFT)

          const routeType = isEditScenario ? 'edit' : 'view'

          // Select the appropriate route based on the transaction type and scenario
          const routeTemplate = routesMapping[transactionType]?.[routeType]

          if (routeTemplate) {
            return routeTemplate
              .replace(':transactionId', transactionId)
              .replace(':transferId', transactionId)
              .replace(':compliancePeriod', compliancePeriod)
              .replace(':complianceReportId', transactionId)
          } else {
            console.error(
              'No route defined for this transaction type and scenario'
            )
          }
        }
      }
    }),
    [currentUser]
  )

  // Determine the appropriate export API endpoint
  const getExportApiEndpoint = useCallback(() => {
    if (hasRoles(roles.supplier)) {
      return apiRoutes.exportOrgTransactions
    } else if (selectedOrgId) {
      return apiRoutes.exportFilteredTransactionsByOrg.replace(
        ':orgID',
        selectedOrgId
      )
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

  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state])

  const handleClearFilters = () => {
    gridRef.current?.resetGrid()
    setPaginationOptions(initialPaginationOptions)
  }

  if (!currentUser) {
    return <Loading />
  }

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
        <Grid item xs={12} lg={7}>
          <BCTypography variant="h5" mb={2} color="primary">
            {t('txn:title')}
          </BCTypography>
          <Box display="flex" gap={1} mb={2} alignItems="center">
            {currentUser?.organization?.orgStatus?.status ===
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
              ref={downloadButtonRef}
              onDownload={handleDownloadTransactions}
              isDownloading={isDownloadingTransactions}
              label={t('txn:downloadAsExcel')}
              downloadLabel={t('txn:downloadingTxnInfo')}
              dataTest="download-transactions-button"
            />
            <ClearFiltersButton
              onClick={handleClearFilters}
              sx={{
                minWidth: 'fit-content',
                whiteSpace: 'nowrap'
              }}
            />
          </Box>
        </Grid>
        <Grid
          item
          xs={12}
          lg={5}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: { xs: 'flex-start', lg: 'flex-end' },
            alignItems: { lg: 'flex-end' }
          }}
        >
          <Role roles={govRoles}>
            <OrganizationList
              onOrgChange={setSelectedOrgId}
              onlyRegistered={false}
            />
          </Role>
        </Grid>
      </Grid>
      <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
        <BCGridViewer2
          ref={gridRef}
          gridKey="transactions-grid"
          columnDefs={transactionsColDefs(t)}
          getRowId={getRowId}
          overlayNoRowsTemplate={t('txn:noTxnsFound')}
          defaultColDef={defaultColDef}
          queryData={queryData}
          dataKey="transactions"
          initialPaginationOptions={initialPaginationOptions}
          onPaginationChange={(newPagination) =>
            setPaginationOptions((prev) => ({
              ...prev,
              ...newPagination
            }))
          }
          highlightedRowId={highlightedId}
        />
      </BCBox>
    </>
  )
}
