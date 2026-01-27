import BCBox from '@/components/BCBox'
import { FEATURE_FLAGS, isFeatureEnabled } from '@/constants/config'
import { ROUTES } from '@/routes/routes'
import breakpoints from '@/themes/base/breakpoints'
import { AppBar, Tab, Tabs } from '@mui/material'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Role } from '@/components/Role'
import { roles, govRoles } from '@/constants/roles'
import { ComplianceReports } from './ComplianceReports'
import { FloatingAlert } from '@/components/BCAlert'
import { useCurrentUser } from '@/hooks/useCurrentUser'

function a11yProps(index) {
  return {
    id: `full-width-tab-${index}`,
    'aria-controls': `full-width-admin-tabs-${index}`
  }
}

export function ReportsMenu() {
  const { t } = useTranslation(['report'])
  const alertRef = useRef()
  const [tabsOrientation, setTabsOrientation] = useState('horizontal')
  const navigate = useNavigate()
  const location = useLocation()
  const { hasAnyRole, hasRoles } = useCurrentUser()
  const isIDIR = hasAnyRole(...govRoles)
  const canAccessChargingSitesTab =
    isIDIR || isFeatureEnabled(FEATURE_FLAGS.MANAGE_CHARGING_SITES)
  const canAccessFseTab = isIDIR || isFeatureEnabled(FEATURE_FLAGS.MANAGE_FSE)
  const isAdministrator = hasRoles(roles.administrator)

  const tabs = useMemo(() => {
    const baseTabs = [
      {
        key: 'complianceReports',
        label: t('tabs.complianceReporting'),
        path: ROUTES.REPORTS.LIST
      }
    ]

    if (canAccessChargingSitesTab) {
      baseTabs.push({
        key: 'chargingSites',
        label: isIDIR ? t('tabs.chargingSites') : t('tabs.manageChargingSites'),
        path: ROUTES.REPORTS.CHARGING_SITE.INDEX
      })
    }

    if (canAccessFseTab) {
      baseTabs.push({
        key: 'manageFSE',
        label: isIDIR ? t('tabs.fseIndex') : t('tabs.manageFSE'),
        path: ROUTES.REPORTS.MANAGE_FSE
      })
      baseTabs.push({
        key: 'fseMap',
        label: t('tabs.fseMap'),
        path: ROUTES.REPORTS.FSE_MAP
      })
    }

    if (isAdministrator) {
      baseTabs.push({
        key: 'reportOpenings',
        label: t('tabs.reportOpenings'),
        path: ROUTES.REPORTS.REPORT_OPENINGS
      })
    }

    return baseTabs
  }, [canAccessChargingSitesTab, canAccessFseTab, isAdministrator, isIDIR, t])

  const tabIndex = useMemo(() => {
    // Only select tab when on the exact index route, not on detail/nested pages
    const index = tabs.findIndex((tab) => {
      return (
        location.pathname === tab.path || location.pathname === `${tab.path}/`
      )
    })
    if (index !== -1) {
      return index
    }

    // Return false when on detail/nested routes to show no tab as selected
    return false
  }, [location.pathname, tabs])

  useEffect(() => {
    function handleTabsOrientation() {
      return window.innerWidth < breakpoints.values.lg
        ? setTabsOrientation('vertical')
        : setTabsOrientation('horizontal')
    }
    window.addEventListener('resize', handleTabsOrientation)
    handleTabsOrientation()
    return () => window.removeEventListener('resize', handleTabsOrientation)
  }, [])

  const handleSetTabValue = (event, newValue) => {
    navigate(tabs[newValue].path)
  }

  // Determine what content to render based on current route
  const renderContent = () => {
    if (location.pathname.includes('/charging-sites')) {
      return (
        <Role roles={[...govRoles, roles.supplier]}>
          <Outlet context={{ alertRef }} />
        </Role>
      )
    }

    if (location.pathname.includes('/fse')) {
      return (
        <Role roles={[...govRoles, roles.supplier]}>
          <Outlet context={{ alertRef }} />
        </Role>
      )
    }

    if (location.pathname.includes('/report-openings')) {
      return (
        <Role roles={[roles.administrator]}>
          <Outlet />
        </Role>
      )
    }

    // Default to compliance reports
    return <ComplianceReports />
  }

  return (
    <BCBox sx={{ bgcolor: 'background.paper' }}>
      {tabs.length > 1 && (
        <AppBar position="static" sx={{ boxShadow: 'none', border: 'none' }}>
          <Tabs
            sx={{
              background: 'rgb(0, 0, 0, 0.08)',
              width: { xs: '100%', md: '50%' }
            }}
            orientation={tabsOrientation}
            value={tabIndex}
            aria-label="Tabs for selection of administration options"
            onChange={handleSetTabValue}
          >
            {tabs.map((tab, index) => (
              <Tab
                key={tab.key}
                label={tab.label}
                wrapped={tab.key === 'complianceReports'}
                {...a11yProps(index)}
              />
            ))}
          </Tabs>
        </AppBar>
      )}
      <FloatingAlert ref={alertRef} data-test="alert-box" />
      <BCBox sx={{ pt: 3 }}>{renderContent()}</BCBox>
    </BCBox>
  )
}
