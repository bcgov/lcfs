import { AppBar, Stack, Tab, Tabs } from '@mui/material'
import BCBox from '@/components/BCBox'
import BCAlert from '@/components/BCAlert'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Role } from '@/components/Role'
import { roles } from '@/constants/roles'
import { ROUTES, buildPath } from '@/routes/routes'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  useCreateComplianceReport,
  useGetComplianceReportList
} from '@/hooks/useComplianceReports'
import { reportsColDefs, defaultSortModel } from './components/_schema'
import { NewComplianceReportButton } from './components/NewComplianceReportButton'
import { ManageChargingSites } from './components/ManageChargingSites'
import BCTypography from '@/components/BCTypography'
import { ClearFiltersButton } from '@/components/ClearFiltersButton'
import { LinkRenderer } from '@/utils/grid/cellRenderers.jsx'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer.jsx'
import { defaultInitialPagination } from '@/constants/schedules.js'
import BCButton from '@/components/BCButton'
import { CalculateOutlined } from '@mui/icons-material'

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
      id={`compliance-tabpanel-${index}`}
      aria-labelledby={`compliance-tab-${index}`}
    >
      {value === index && children}
    </BCBox>
  )
}

export const ComplianceReports = () => {
  const { t } = useTranslation(['common', 'report'])
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const currentTab = searchParams.get('tab') || 'compliance-reporting'
  const [tabsOrientation, setTabsOrientation] = useState('horizontal')

  const [alertMessage, setAlertMessage] = useState('')
  const [isButtonLoading, setIsButtonLoading] = useState(false)
  const [alertSeverity, setAlertSeverity] = useState('info')

  const [paginationOptions, setPaginationOptions] = useState(
    initialPaginationOptions
  )


  const gridRef = useRef()
  const alertRef = useRef()
  const newButtonRef = useRef(null)
  const { hasRoles, data: currentUser } = useCurrentUser()

  const queryData = useGetComplianceReportList(paginationOptions, {
    cacheTime: 0,
    staleTime: 0
  })

  const handleRefresh = () => {
    queryData.refetch()
  }

  const getRowId = useCallback(
    (params) => params.data.complianceReportGroupUuid,
    []
  )


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
      newSearchParams.set('tab', 'compliance-reporting')
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

  const { mutate: createComplianceReport, isLoading: isCreating } =
    useCreateComplianceReport(currentUser?.organization?.organizationId, {
      onSuccess: (response, variables) => {
        setAlertMessage(
          t('report:actionMsgs.successText', {
            status: 'created'
          })
        )
        setIsButtonLoading(false)
        setAlertSeverity('success')
        navigate(
          buildPath(ROUTES.REPORTS.VIEW, {
            compliancePeriod: response.data.compliancePeriod.description,
            complianceReportId: response.data.complianceReportId
          }),
          { state: { data: response.data, newReport: true } }
        )
        alertRef.current.triggerAlert()
      },
      onError: (_error, _variables) => {
        setIsButtonLoading(false)
        const errorMsg = _error.response.data?.detail
        setAlertMessage(errorMsg)
        setAlertSeverity('error')
        alertRef.current.triggerAlert()
      }
    })

  useEffect(() => {
    if (isCreating) {
      setIsButtonLoading(true)
    }
  }, [isCreating])

  const defaultColDef = useMemo(
    () => ({
      cellRenderer: LinkRenderer,
      cellRendererParams: {
        url: (data) =>
          `${data.data.compliancePeriod}/${data.data.complianceReportId}`,
        state: (data) => ({ reportStatus: data?.reportStatus })
      }
    }),
    []
  )

  const handleChangeTab = (event, newValue) => {
    const tabs = ['compliance-reporting', 'manage-charging-sites', 'manage-fse']
    const newTab = tabs[newValue] || 'compliance-reporting'
    const newSearchParams = new URLSearchParams(searchParams)
    newSearchParams.set('tab', newTab)
    setSearchParams(newSearchParams)
  }

  const handleClearFilters = () => {
    setPaginationOptions(initialPaginationOptions)
    sessionStorage.removeItem('compliance-reports-grid-filter')
    if (gridRef && gridRef.current) {
      gridRef.current.clearFilters()
    }
  }

  // Convert tab parameter to index
  const getTabIndex = (tab) => {
    switch (tab) {
      case 'manage-charging-sites':
        return 1
      case 'manage-fse':
        return 2
      default:
        return 0
    }
  }
  const tabIndex = getTabIndex(currentTab)

  // Build tabs array
  const tabs = [
    {
      label: t('report:complianceReportingTab', 'Compliance reporting'),
      content: (
        <>
          <Stack
            direction={{ md: 'coloumn', lg: 'row' }}
            spacing={{ xs: 2, sm: 2, md: 3 }}
            useFlexGap
            flexWrap="wrap"
            my={{ xs: 1, sm: 1, md: 2 }}
            mx={0}
          >
            <Role roles={[roles.supplier]}>
              <NewComplianceReportButton
                ref={newButtonRef}
                handleNewReport={(option) => {
                  createComplianceReport({
                    compliancePeriod: option.description,
                    organizationId: currentUser?.organization?.organizationId,
                    status: COMPLIANCE_REPORT_STATUSES.DRAFT
                  })
                }}
                isButtonLoading={isButtonLoading}
                setIsButtonLoading={setIsButtonLoading}
              />
            </Role>
            <ClearFiltersButton
              onClick={handleClearFilters}
              sx={{
                display: 'flex',
                alignItems: 'center'
              }}
            />
            <BCButton
              data-test="credit-calculator"
              sx={{ '& .MuiSvgIcon-root': { fontSize: '1.2rem !important' } }}
              variant="outlined"
              size="small"
              color="primary"
              onClick={() => navigate(ROUTES.REPORTS.CALCULATOR)}
              startIcon={<CalculateOutlined />}
            >
              {t('report:calcTitle')}
            </BCButton>
          </Stack>
          <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
            <BCGridViewer
              gridRef={gridRef}
              gridKey="compliance-reports-grid"
              columnDefs={reportsColDefs(
                t,
                hasRoles(roles.supplier),
                handleRefresh
              )}
              queryData={queryData}
              dataKey="reports"
              getRowId={getRowId}
              overlayNoRowsTemplate={t('report:noReportsFound')}
              autoSizeStrategy={{
                type: 'fitGridWidth',
                defaultMinWidth: 50,
                defaultMaxWidth: 600
              }}
              defaultColDef={defaultColDef}
              paginationOptions={paginationOptions}
              onPaginationChange={(newPagination) => {
                setPaginationOptions(newPagination)
              }}
            />
          </BCBox>
        </>
      )
    },
    {
      label: t('report:manageChargingSitesTab', 'Manage charging sites'),
      content: (
        <ManageChargingSites
          paginationOptions={paginationOptions}
          setPaginationOptions={setPaginationOptions}
          handleClearFilters={handleClearFilters}
        />
      )
    },
    {
      label: t('report:manageFSETab', 'Manage FSE'),
      content: (
        <BCBox>
          <BCTypography variant="body1" sx={{ textAlign: 'center', py: 4 }}>
            {t('report:comingSoon', 'Coming soon')}
          </BCTypography>
        </BCBox>
      )
    }
  ]

  return (
    <BCBox>
      {alertMessage && (
        <BCAlert
          ref={alertRef}
          data-test="alert-box"
          severity={alertSeverity}
          delay={6500}
          sx={{ mb: 4 }}
        >
          {alertMessage}
        </BCAlert>
      )}

      <BCBox sx={{ mt: 2, bgcolor: 'background.paper' }}>
        <AppBar position="static" sx={{ boxShadow: 'none', border: 'none' }}>
          <Tabs
            orientation={tabsOrientation}
            value={tabIndex}
            onChange={handleChangeTab}
            aria-label="Compliance tabs"
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              backgroundColor: 'rgba(0, 0, 0, 0.08)',
              width: 'fit-content',
              maxWidth: { xs: '100%', md: '70%', lg: '60%' },
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
          {tabIndex === 1
            ? t('report:manageChargingSitesTitle', 'Manage charging sites')
            : tabIndex === 2
              ? t('report:manageFSETitle', 'Manage FSE')
              : t('report:title')}
        </BCTypography>

        {tabs.map((tab, idx) => (
          <TabPanel key={idx} value={tabIndex} index={idx}>
            {tab.content}
          </TabPanel>
        ))}
      </BCBox>
    </BCBox>
  )
}
