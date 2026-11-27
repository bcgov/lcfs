import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { DownloadButton } from '@/components/DownloadButton'
import { apiRoutes } from '@/constants/routes'
import { ROUTES } from '@/routes/routes'
import { useApiService } from '@/services/useApiService'
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Role } from '@/components/Role'
import { defaultSortModel, transactionsColDefs } from './_schema'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import '@/hooks/useOrganization'
import {
  ORGANIZATION_STATUSES,
  TRANSACTION_STATUSES,
  TRANSFER_STATUSES
} from '@/constants/statuses'
import { govRoles, roles } from '@/constants/roles'
import OrganizationList from './components/OrganizationList'
import Loading from '@/components/Loading'
import { ConditionalLinkRenderer } from '@/utils/grid/cellRenderers'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import type {
  BCGridQueryData,
  BCGridRow,
  BCGridViewerProps,
  BCPaginationFilter,
  BCPaginationOptions
} from '@/components/BCDataGrid/types'
import type { GetRowIdParams } from 'ag-grid-community'
import type { RendererProps } from '@/utils/grid/cellRenderers'
import type { ReactNode, SyntheticEvent } from 'react'
import type { AgGridReact } from 'ag-grid-react'
import {
  useGetTransactionList,
  useDownloadTransactions
} from '@/hooks/useTransactions'
import '@/constants/schedules'
import { CreditTradingMarket } from './CreditTradingMarket/CreditTradingMarket'
import { CreditMarketAuditLogTable } from './CreditTradingMarket/CreditMarketAuditLogTable'

const initialPaginationOptions: BCPaginationOptions = {
  page: 1,
  size: 10,
  sortOrders: defaultSortModel,
  filters: []
}

interface TransactionRow extends BCGridRow {
  transactionId: string | number
  transactionType: string
  fromOrganization?: string | null
  status?: string
  compliancePeriod?: string | null
}

const isTransactionRow = (data: unknown): data is TransactionRow =>
  typeof data === 'object' &&
  data !== null &&
  'transactionId' in data &&
  (typeof data.transactionId === 'string' ||
    typeof data.transactionId === 'number') &&
  'transactionType' in data &&
  typeof data.transactionType === 'string' &&
  (!('fromOrganization' in data) ||
    data.fromOrganization === null ||
    typeof data.fromOrganization === 'string') &&
  (!('status' in data) || typeof data.status === 'string') &&
  (!('compliancePeriod' in data) ||
    data.compliancePeriod === null ||
    typeof data.compliancePeriod === 'string')

interface TabPanelProps {
  children: ReactNode
  value: number
  index: number
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <BCBox
      role="tabpanel"
      hidden={value !== index}
      id={`transaction-tabpanel-${index}`}
      aria-labelledby={`transaction-tab-${index}`}
      sx={{ pt: 2 }}
    >
      {value === index && children}
    </BCBox>
  )
}

export const Transactions = () => {
  const { t } = useTranslation(['common', 'transaction'])
  const navigate = useNavigate()
  const location = useLocation()
  useApiService()
  const gridRef = useRef<AgGridReact<BCGridRow> | null>(null)
  const downloadButtonRef = useRef(null)
  const { data: currentUser, hasAnyRole, hasRoles } = useCurrentUser()

  const [tabsOrientation, setTabsOrientation] = useState<
    'horizontal' | 'vertical'
  >('horizontal')

  const [isDownloadingTransactions, setIsDownloadingTransactions] =
    useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState<
    'info' | 'success' | 'warning' | 'error' | 'pending'
  >('info')

  const [paginationOptions, setPaginationOptions] =
    useState<BCPaginationOptions>(initialPaginationOptions)

  // Initialize selected organization from session storage for persistence
  const [selectedOrg, setSelectedOrg] = useState<{
    id: string | number | null
    label: string | null
    name: string | null
  }>(() => {
    const savedOrgFilter = sessionStorage.getItem('transactions-grid-orgFilter')
    if (savedOrgFilter) {
      try {
        return JSON.parse(savedOrgFilter)
      } catch (error) {
        console.warn('Failed to parse saved organization filter:', error)
      }
    }
    return { id: null, label: null, name: null }
  })

  const transactionQuery = useGetTransactionList(
    {
      ...paginationOptions,
      selectedOrgId: selectedOrg?.id
    },
    {
      gcTime: 0,
      staleTime: 0
    }
  )
  const queryData: BCGridQueryData<BCGridRow> = {
    data: transactionQuery.data,
    error: transactionQuery.error,
    isError: transactionQuery.isError,
    isLoading: transactionQuery.isLoading
  }

  const { mutateAsync: downloadTransactions } = useDownloadTransactions({})

  const getRowId = useCallback((params: GetRowIdParams) => {
    return (
      params.data.transactionType.toLowerCase() +
      '-' +
      params.data.transactionId
    )
  }, [])

  const shouldRenderLink = useCallback(
    (props: RendererProps) => {
      const transactionType =
        props.data &&
        typeof props.data === 'object' &&
        'transactionType' in props.data
          ? props.data.transactionType
          : undefined
      if (typeof transactionType !== 'string') return false
      // Legacy/Standalone and Aggregator Issuance transactions have no detail view page
      if (
        transactionType === 'StandaloneTransaction' ||
        transactionType === 'AggregatorIssuance'
      ) {
        return false
      }
      return (
        transactionType !== 'ComplianceReport' ||
        hasAnyRole(
          roles.government,
          roles.signing_authority,
          roles.compliance_reporting
        )
      )
    },
    [hasAnyRole]
  )

  const defaultColDef = useMemo(
    () => ({
      cellRenderer: ConditionalLinkRenderer(shouldRenderLink),
      cellRendererParams: {
        isAbsolute: true,
        url: (params: { data: unknown }) => {
          if (!isTransactionRow(params.data)) return undefined
          const data = params.data
          const {
            transactionId,
            transactionType,
            fromOrganization,
            status,
            compliancePeriod
          } = data
          const userOrgName = currentUser?.organization?.name

          // Define routes mapping for transaction types
          const routesMapping: Partial<
            Record<string, Partial<Record<'view' | 'edit', string>>>
          > = {
            Transfer: {
              view: ROUTES.TRANSFERS.VIEW,
              edit: ROUTES.TRANSFERS.EDIT
            },
            AdminAdjustment: {
              view: currentUser?.isGovernmentUser
                ? ROUTES.TRANSACTIONS.ADMIN_ADJUSTMENT.VIEW
                : ROUTES.TRANSACTIONS.ADMIN_ADJUSTMENT.ORG_VIEW,
              edit: ROUTES.TRANSACTIONS.ADMIN_ADJUSTMENT.EDIT
            },
            InitiativeAgreement: {
              view: currentUser?.isGovernmentUser
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
              .replace(':transactionId', String(transactionId))
              .replace(':transferId', String(transactionId))
              .replace(':compliancePeriod', String(compliancePeriod))
              .replace(':complianceReportId', String(transactionId))
          } else {
            console.error(
              'No route defined for this transaction type and scenario'
            )
          }
        }
      }
    }),
    [currentUser, shouldRenderLink]
  )

  // Determine the appropriate export API endpoint
  const getExportApiEndpoint = useCallback(() => {
    if (hasRoles(roles.supplier)) {
      return apiRoutes.exportOrgTransactions
    } else if (selectedOrg.id) {
      return apiRoutes.exportFilteredTransactionsByOrg.replace(
        ':orgID',
        String(selectedOrg?.id)
      )
    }
    return apiRoutes.exportTransactions
  }, [selectedOrg, hasRoles])

  const convertToBackendFilters = (
    model: Record<string, BCPaginationFilter> = {}
  ) =>
    Object.entries(model).map(([field, cfg]) => ({
      field,
      filterType: cfg.filterType || 'text',
      type: cfg.type,
      filter: cfg.filter,
      dateFrom: cfg.dateFrom,
      dateTo: cfg.dateTo
    }))

  const buildExportPayload = (
    gridApi:
      | { getFilterModel?: () => Record<string, BCPaginationFilter> }
      | undefined
  ) => ({
    page: 1,
    size: 10000, // ignored by back-end but required by schema
    filters: convertToBackendFilters(gridApi?.getFilterModel?.() || {}),
    sortOrders: []
  })

  const handleDownloadTransactions = async () => {
    setIsDownloadingTransactions(true)
    setAlertMessage('')
    try {
      getExportApiEndpoint()
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

  // Function to update organization filter with session storage persistence
  const updateOrgFilter = useCallback(
    (orgData: {
      id: string | number | null
      label: string | null
      name: string | null
    }) => {
      setSelectedOrg(orgData)

      try {
        if (orgData.id && orgData.label) {
          sessionStorage.setItem(
            'transactions-grid-orgFilter',
            JSON.stringify(orgData)
          )
        } else {
          sessionStorage.removeItem('transactions-grid-orgFilter')
        }
      } catch (error) {
        console.warn(
          'Failed to update organization filter in session storage:',
          error
        )
      }
    },
    []
  )

  const resetGridFiltersState = useCallback(() => {
    setPaginationOptions(initialPaginationOptions)
    updateOrgFilter({ id: null, label: null, name: null })
    try {
      sessionStorage.removeItem('transactions-grid-filter')
      sessionStorage.removeItem('transactions-grid-column')
    } catch (error) {
      console.warn('Failed to clear transactions grid cache:', error)
    }
  }, [updateOrgFilter])

  const filterToolbarConfig = useMemo<
    NonNullable<BCGridViewerProps<BCGridRow>['filterToolbarConfig']>
  >(() => {
    if (!selectedOrg.id || !selectedOrg.label) {
      return { additionalPills: [] }
    }
    const config: NonNullable<
      BCGridViewerProps<BCGridRow>['filterToolbarConfig']
    > = {
      additionalPills: [
        {
          id: `organization-${selectedOrg.id}`,
          label: t('common:Organization', 'Organization'),
          value: selectedOrg.name ?? undefined,
          type: 'select',
          onRemove: () => updateOrgFilter({ id: null, label: null, name: null })
        }
      ]
    }
    return config
  }, [selectedOrg.id, selectedOrg.label, selectedOrg.name, t, updateOrgFilter])

  // Determine if the user is eligible for credit trading market tab
  const isBCeIDUser = !hasRoles(roles.government)
  const isRegistered =
    currentUser?.organization?.orgStatus?.status ===
    ORGANIZATION_STATUSES.REGISTERED
  const showCreditTradingTab =
    hasRoles(roles.government) || (isBCeIDUser && isRegistered)

  const normalizedPath = location.pathname.replace(/\/+$/, '')
  const currentTab =
    normalizedPath === ROUTES.TRANSACTIONS.CREDIT_TRADING_MARKET
      ? 'credit-trading-market'
      : normalizedPath === ROUTES.TRANSACTIONS.CREDIT_TRADING_MARKET_AUDIT_LOG
        ? 'credit-trading-market-audit-log'
        : 'transactions'

  const tabRoutes: string[] = [ROUTES.TRANSACTIONS.LIST]
  if (showCreditTradingTab) {
    tabRoutes.push(ROUTES.TRANSACTIONS.CREDIT_TRADING_MARKET)
  }
  if (showCreditTradingTab && hasRoles(roles.government)) {
    tabRoutes.push(ROUTES.TRANSACTIONS.CREDIT_TRADING_MARKET_AUDIT_LOG)
  }

  useEffect(() => {
    if (!currentUser) return

    const onMarketPath =
      normalizedPath === ROUTES.TRANSACTIONS.CREDIT_TRADING_MARKET
    const onAuditPath =
      normalizedPath === ROUTES.TRANSACTIONS.CREDIT_TRADING_MARKET_AUDIT_LOG

    if ((onMarketPath || onAuditPath) && !showCreditTradingTab) {
      navigate(ROUTES.TRANSACTIONS.LIST, { replace: true })
      return
    }

    if (onAuditPath && !hasRoles(roles.government)) {
      navigate(ROUTES.TRANSACTIONS.LIST, { replace: true })
    }
  }, [currentUser, normalizedPath, showCreditTradingTab, hasRoles, navigate])

  if (!currentUser) {
    return <Loading />
  }

  const handleChangeTab = (_event: SyntheticEvent, newValue: number) => {
    const nextRoute = tabRoutes[newValue] || ROUTES.TRANSACTIONS.LIST
    navigate(nextRoute)
  }

  // Convert tab parameter to index
  const getTabIndex = (tab: string) => {
    if (tab === 'credit-trading-market' && showCreditTradingTab) return 1
    if (
      tab === 'credit-trading-market-audit-log' &&
      showCreditTradingTab &&
      hasRoles(roles.government)
    ) {
      return 2
    }
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
                  onOrgChange={({ id, label, name }) => {
                    updateOrgFilter({ id, label, name })
                  }}
                  onlyRegistered={false}
                />
              </Role>
            </Grid>
          </Grid>
          <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
            <BCGridViewer
              gridRef={gridRef}
              gridKey="transactions-grid"
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
              filterToolbarConfig={filterToolbarConfig}
              onClearFilters={resetGridFiltersState}
            />
          </BCBox>
        </>
      )
    }
  ]

  // Add credit trading market tab if eligible
  if (showCreditTradingTab) {
    tabs.push({
      label: t('txn:creditTradingMarketTab', 'Credit trading market'),
      content: (
        <BCBox mt={0}>
          <CreditTradingMarket />
        </BCBox>
      )
    })
  }

  if (showCreditTradingTab && hasRoles(roles.government)) {
    tabs.push({
      label: t('creditMarket:auditLog', 'Audit log'),
      content: (
        <BCBox mt={0}>
          <CreditMarketAuditLogTable />
        </BCBox>
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

          <BCTypography
            variant="h5"
            mb={tabIndex === 1 ? 1.5 : 1}
            mt={3}
            color="primary"
          >
            {tabIndex === 1
              ? t('txn:creditTradingMarketTitle')
              : tabIndex === 2
                ? t('creditMarket:auditLog', 'Audit log')
                : t('txn:title')}
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
