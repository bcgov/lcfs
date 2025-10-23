import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { AppBar, Tab, Tabs } from '@mui/material'
import BCBox from '@/components/BCBox'
import BCAlert from '@/components/BCAlert'
import BCTypography from '@/components/BCTypography'
import { OrganizationDetailsCard } from './OrganizationDetailsCard'
import { OrganizationUsers } from './OrganizationUsers'
import { CreditLedger } from './CreditLedger'
import CompanyOverview from './components/CompanyOverview'
import { PenaltyLog } from './components/PenaltyLog/PenaltyLog'
import PenaltyLogManage from './components/PenaltyLog/PenaltyLogManage'
import SupplyHistory from './components/SupplyHistory'
import ComplianceTracking from './components/ComplianceTracking'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { roles } from '@/constants/roles'
import { ROUTES } from '@/routes/routes'
import breakpoints from '@/themes/base/breakpoints'
import {
  orgDashboardRenderers,
  orgDashboardRoutes
} from '@/routes/routeConfig/organizationRoutes'
import { useOrganization } from '@/hooks/useOrganization'
import { useOrganizationPageStore } from '@/stores/useOrganizationPageStore'

function TabPanel({ children, value, index }) {
  return (
    <BCBox
      role="tabpanel"
      hidden={value !== index}
      id={`organization-tabpanel-${index}`}
      aria-labelledby={`organization-tab-${index}`}
    >
      {value === index && children}
    </BCBox>
  )
}

export const OrganizationView = ({ addMode = false }) => {
  const [tabsOrientation, setTabsOrientation] = useState('horizontal')

  const location = useLocation()
  const navigate = useNavigate()
  const { orgID } = useParams()
  const [alert, setAlert] = useState(null)

  const { data: currentUser, hasRoles } = useCurrentUser()
  const setOrganizationContext = useOrganizationPageStore(
    (state) => state.setOrganizationContext
  )
  const resetOrganizationContext = useOrganizationPageStore(
    (state) => state.resetOrganizationContext
  )

  // Get the organization ID - either from URL params (IDIR users) or from current user (BCeID users)
  const organizationId = orgID ?? currentUser?.organization?.organizationId

  // Check if user is government (IDIR) - only they should see all tabs
  const isGovernment = hasRoles(roles.government)
  const showOrganizationHeader = isGovernment && !addMode

  const { data: organizationData } = useOrganization(organizationId, {
    enabled: showOrganizationHeader && !!organizationId
  })

  useEffect(() => {
    if (location.state?.message) {
      setAlert({
        message: location.state.message,
        severity: location.state.severity || 'info'
      })
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location, navigate])

  const tabConfig = useMemo(() => {
    return orgDashboardRoutes(organizationId, isGovernment)
  }, [isGovernment, organizationId])

  // Determine current tab index based on location
  const tabIndex = useMemo(() => {
    const currentPath = location.pathname

    // Direct access to manage route should highlight penalty log tab
    if (currentPath.includes('/penalty-log/manage')) {
      const penaltyIndex = tabConfig.findIndex((config) =>
        config.path.includes('/penalty-log')
      )
      return penaltyIndex >= 0 ? penaltyIndex : 0
    }

    const matchIndex = tabConfig.findIndex((config) => {
      if (config.match) {
        return config.match(currentPath)
      }
      return currentPath === config.path
    })
    return matchIndex >= 0 ? matchIndex : 0
  }, [location.pathname, tabConfig])

  useEffect(() => {
    // A function that sets the orientation state of the tabs.
    function handleTabsOrientation() {
      return window.innerWidth < breakpoints.values.lg
        ? setTabsOrientation('vertical')
        : setTabsOrientation('horizontal')
    }
    window.addEventListener('resize', handleTabsOrientation)
    handleTabsOrientation()
    return () => window.removeEventListener('resize', handleTabsOrientation)
  }, [tabsOrientation])

  const handleTabChange = (event, newValue) => {
    const targetPath = tabConfig[newValue]?.path
    if (targetPath) {
      navigate(targetPath)
    }
  }

  // Render content based on current route
  const renderContent = useCallback(() => {
    const currentPath = location.pathname || ''
    return orgDashboardRenderers(
      isGovernment,
      currentPath,
      organizationId,
      addMode,
      navigate
    )
  }, [isGovernment, organizationId, location, addMode, navigate])

  const currentTab = tabConfig[tabIndex] || null
  const currentTabLabel = currentTab?.label || null

  const organizationTitle =
    showOrganizationHeader && organizationData?.name
      ? `${organizationData.name}${
          currentTabLabel ? ` - ${currentTabLabel}` : ''
        }`
      : currentTabLabel

  useEffect(() => {
    if (!showOrganizationHeader) {
      resetOrganizationContext()
      return
    }

    if (!organizationData?.name) {
      resetOrganizationContext()
      return
    }

    setOrganizationContext({
      organizationName: organizationData.name,
      activeTabLabel: currentTabLabel
    })

    return () => {
      resetOrganizationContext()
    }
  }, [
    showOrganizationHeader,
    organizationData?.name,
    currentTabLabel,
    setOrganizationContext,
    resetOrganizationContext
  ])

  return (
    <BCBox>
      {alert && (
        <BCAlert severity={alert.severity} sx={{ mb: 4 }}>
          {alert.message}
        </BCAlert>
      )}

      <BCBox sx={{ mt: 2, bgcolor: 'background.paper' }}>
        <AppBar
          position="static"
          sx={{ boxShadow: 'none', border: 'none', width: 'fit-content' }}
        >
          <Tabs
            orientation={tabsOrientation}
            value={tabIndex}
            onChange={handleTabChange}
            aria-label="Organization tabs"
            sx={{
              background: 'rgba(0, 0, 0, 0.08)',
              maxWidth: '100%',
              '& .MuiTab-root': {
                minWidth: 'auto',
                paddingX: 2,
                marginX: 1,
                whiteSpace: 'nowrap'
              },
              '& .MuiTabs-flexContainer': {
                flexWrap: 'nowrap'
              }
            }}
            variant="scrollable"
            scrollButtons="auto"
          >
            {tabConfig.map((config, idx) => (
              <Tab key={config.path} label={config.label} />
            ))}
          </Tabs>
        </AppBar>
        {organizationTitle && (
          <BCTypography variant="h5" color="primary" mt={3}>
            {organizationTitle}
          </BCTypography>
        )}
        <BCBox sx={{ pt: 3 }}>{renderContent()}</BCBox>
      </BCBox>
    </BCBox>
  )
}
