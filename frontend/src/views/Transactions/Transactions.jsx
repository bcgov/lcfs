import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { DownloadButton } from '@/components/DownloadButton'
import { ClearFiltersButton } from '@/components/ClearFiltersButton'
import { apiRoutes } from '@/constants/routes'
import { ROUTES } from '@/routes/routes'
import { useApiService } from '@/services/useApiService'
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { AppBar, Box, Grid, Tab, Tabs } from '@mui/material'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Role } from '@/components/Role'
import { defaultSortModel, transactionsColDefs } from './_schema'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useOrganization } from '@/hooks/useOrganization'
import {
  ORGANIZATION_STATUSES,
  TRANSACTION_STATUSES,
  TRANSFER_STATUSES
} from '@/constants/statuses'
import { govRoles, roles } from '@/constants/roles'
import OrganizationList from './components/OrganizationList'
import Loading from '@/components/Loading'
import { ConditionalLinkRenderer } from '@/utils/grid/cellRenderers.jsx'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer.jsx'
import {
  useGetTransactionList,
  useDownloadTransactions
} from '@/hooks/useTransactions'
import { defaultInitialPagination } from '@/constants/schedules.js'
import { CreditTradingMarket } from './CreditTradingMarket/CreditTradingMarket'
import { CreditMarketDetailsCard } from './CreditTradingMarket/CreditMarketDetailsCard'

const initialPaginationOptions = {
  page: 1,
  size: 10,
  sortOrders: defaultSortModel,
  filters: []
}

function TabPanel({ children, value, index }) {
  return (
    <BCBox
      role="tabpanel"
      hidden={value !== index}
      id={`transaction-tabpanel-${index}`}
      aria-labelledby={`transaction-tab-${index}`}
      sx={{ pt: 3 }}
    >
      {value === index && children}
    </BCBox>
  )
}

export const Transactions = () => {
  const { t } = useTranslation(['common', 'transaction'])
  const navigate = useNavigate()
  const location = useLocation()
  const apiService = useApiService()
  const gridRef = useRef()
  const downloadButtonRef = useRef(null)
  const { data: currentUser, hasAnyRole, hasRoles } = useCurrentUser()

  const [searchParams, setSearchParams] = useSearchParams()
  const highlightedId = searchParams.get('hid')
  const currentTab = searchParams.get('tab') || 'transactions'
  const [tabsOrientation, setTabsOrientation] = useState('horizontal')

  const [isDownloadingTransactions, setIsDownloadingTransactions] =
    useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')

  const [paginationOptions, setPaginationOptions] = useState(
    initialPaginationOptions
  )
  const [selectedOrg, setSelectedOrg] = useState({
    id: null,
    label: null
  })

  const queryData = useGetTransactionList(
    {
      ...paginationOptions,
      selectedOrgId: selectedOrg?.id
    },
    {
      cacheTime: 0,
      staleTime: 0
    }
  )

  const { mutateAsync: downloadTransactions } = useDownloadTransactions()

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
              view: ROUTES.TRANSFERS.VIEW,
              edit: ROUTES.TRANSFERS.EDIT
            },
            AdminAdjustment: {
              view: currentUser.isGovernmentUser
                ? ROUTES.TRANSACTIONS.ADMIN_ADJUSTMENT.VIEW
                : ROUTES.TRANSACTIONS.ADMIN_ADJUSTMENT.ORG_VIEW,
              edit: ROUTES.TRANSACTIONS.ADMIN_ADJUSTMENT.EDIT
            },
            InitiativeAgreement: {
              view: currentUser.isGovernmentUser
                ? ROUTES.TRANSACTIONS.INITIATIVE_AGREEMENT.VIEW
                : ROUTES.TRANSACTIONS.INITIATIVE_AGREEMENT.ORG_VIEW,
              edit: ROUTES.TRANSACTIONS.INITIATIVE_AGREEMENT.EDIT
            },
            ComplianceReport: {
              view: ROUTES.REPORTS.VIEW,
              edit: ROUTES.TRANSACTIONS.INITIATIVE_AGREEMENT.EDIT
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
    } else if (selectedOrg.id) {
      return apiRoutes.exportFilteredTransactionsByOrg.replace(
        ':orgID',
        selectedOrg?.id
      )
    }
    return apiRoutes.exportTransactions
  }, [selectedOrg, currentUser, hasRoles])

  const convertToBackendFilters = (model = {}) =>
    Object.entries(model).map(([field, cfg]) => ({
      field,
      filterType: cfg.filterType || 'text',
      type: cfg.type,
      filter: cfg.filter,
      dateFrom: cfg.dateFrom,
      dateTo: cfg.dateTo
    }))

  const buildExportPayload = (gridApi) => ({
    page: 1,
    size: 10000, // ignored by back-end but required by schema
    filters: convertToBackendFilters(gridApi.getFilterModel?.() || {}),
    sortOrders: []
  })

  const handleDownloadTransactions = async () => {
    setIsDownloadingTransactions(true)
    setAlertMessage('')
    try {
      const endpoint = getExportApiEndpoint()
      await downloadTransactions({
        format: 'xlsx',
        endpoint: getExportApiEndpoint(),
        body: buildExportPayload(gridRef.current?.api)
      })
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

  // Ensure URL has tab parameter (basic setup)
  useEffect(() => {
    const currentTabParam = searchParams.get('tab')

    if (!currentTabParam) {
      const newSearchParams = new URLSearchParams(searchParams)
      newSearchParams.set('tab', 'transactions')
      setSearchParams(newSearchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth < 500) {
        setTabsOrientation('vertical')
      } else {
        setTabsOrientation('horizontal')
      }
    }
    window.addEventListener('resize', handleResize)
    handleResize()
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleChangeTab = (event, newValue) => {
    const newTab = newValue === 0 ? 'transactions' : 'credit-trading-market'
    const newSearchParams = new URLSearchParams(searchParams)
    newSearchParams.set('tab', newTab)
    setSearchParams(newSearchParams)
  }

  const handleClearFilters = () => {
    setPaginationOptions(initialPaginationOptions)
    setSelectedOrg({ organizationId: null, label: null })
    if (gridRef && gridRef.current) {
      gridRef.current.clearFilters()
    }
  }

  if (!currentUser) {
    return <Loading />
  }

  // Determine if the user is eligible for credit trading market tab
  const isBCeIDUser = !hasRoles(roles.government)
  const isRegistered =
    currentUser?.organization?.orgStatus?.status ===
    ORGANIZATION_STATUSES.REGISTERED
  const showCreditTradingTab =
    hasRoles(roles.government) || (isBCeIDUser && isRegistered)

  // Validate access to credit trading market tab
  useEffect(() => {
    const currentTabParam = searchParams.get('tab')
    if (currentTabParam === 'credit-trading-market' && !showCreditTradingTab) {
      // Redirect to transactions tab if user doesn't have access to credit trading market
      const newSearchParams = new URLSearchParams(searchParams)
      newSearchParams.set('tab', 'transactions')
      setSearchParams(newSearchParams, { replace: true })
    }
  }, [searchParams, setSearchParams, showCreditTradingTab])

  // Convert tab parameter to index
  const getTabIndex = (tab) => {
    if (tab === 'credit-trading-market' && showCreditTradingTab) return 1
    return 0
  }
  const tabIndex = getTabIndex(currentTab)

  // Build tabs array
  const tabs = [
    {
      label: t('txn:transactionsTab', 'Transactions'),
      content: (
        <>
          <Grid container spacing={2}>
            <Grid item xs={12} lg={7}>
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
                      onClick={() => navigate(ROUTES.TRANSFERS.ADD)}
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
                    onClick={() => navigate(ROUTES.TRANSACTIONS.ADD)}
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
                <ClearFiltersButton onClick={handleClearFilters} />
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
                  selectedOrg={selectedOrg}
                  onOrgChange={({ id, label }) => {
                    setSelectedOrg({ id, label })
                  }}
                  onlyRegistered={false}
                />
              </Role>
            </Grid>
          </Grid>
          <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
            <BCGridViewer
              gridRef={gridRef}
              gridKey="transactions-grid-v2"
              columnDefs={transactionsColDefs(t)}
              getRowId={getRowId}
              overlayNoRowsTemplate={t('txn:noTxnsFound')}
              defaultColDef={defaultColDef}
              queryData={queryData}
              dataKey="transactions"
              paginationOptions={paginationOptions}
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
  ]

  // Add credit trading market tab if eligible
  if (showCreditTradingTab) {
    tabs.push({
      label: t('txn:creditTradingMarketTab', 'Credit Trading Market'),
      content: (
        <>
          {!hasRoles(roles.government) && <CreditMarketDetailsCard />}
          <BCBox mt={!hasRoles(roles.government) ? 3 : 0}>
            <CreditTradingMarket />
          </BCBox>
        </>
      )
    })
  }

  return (
    <BCBox>
      {alertMessage && (
        <BCAlert data-test="alert-box" severity={alertSeverity} sx={{ mb: 4 }}>
          {alertMessage}
        </BCAlert>
      )}

      {tabs.length === 1 ? (
        <BCBox>
          <BCTypography variant="h5" mb={2} color="primary">
            {t('txn:title')}
          </BCTypography>
          <BCBox mt={3}>{tabs[0].content}</BCBox>
        </BCBox>
      ) : (
        <BCBox sx={{ mt: 2, bgcolor: 'background.paper' }}>
          <AppBar position="static" sx={{ boxShadow: 'none', border: 'none' }}>
            <Tabs
              orientation={tabsOrientation}
              value={tabIndex}
              onChange={handleChangeTab}
              aria-label="Transaction tabs"
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                backgroundColor: 'rgba(0, 0, 0, 0.08)',
                width: 'fit-content',
                maxWidth: { xs: '100%', md: '50%', lg: '40%' },
                '& .MuiTab-root': {
                  minWidth: 'auto',
                  paddingX: 3,
                  marginX: 1,
                  whiteSpace: 'nowrap'
                },
                '& .MuiTabs-flexContainer': {
                  flexWrap: 'nowrap'
                }
              }}
            >
              {tabs.map((tab, idx) => (
                <Tab key={idx} label={tab.label} />
              ))}
            </Tabs>
          </AppBar>

          <BCTypography variant="h5" mb={2} mt={2} color="primary">
            {t('txn:title')}
          </BCTypography>

          {tabs.map((tab, idx) => (
            <TabPanel key={idx} value={tabIndex} index={idx}>
              {tab.content}
            </TabPanel>
          ))}
        </BCBox>
      )}
    </BCBox>
  )
}
