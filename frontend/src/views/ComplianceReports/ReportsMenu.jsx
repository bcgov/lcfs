import BCBox from '@/components/BCBox'
import { ROUTES } from '@/routes/routes'
import breakpoints from '@/themes/base/breakpoints'
import { AppBar, Tab, Tabs } from '@mui/material'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useNavigate, useLocation, matchPath } from 'react-router-dom'
import { Role } from '@/components/Role'
import { roles, govRoles } from '@/constants/roles'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { ComplianceReports } from './ComplianceReports'
import { ChargingEquipment } from '@/views/ChargingEquipment'
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
  const { hasAnyRole } = useCurrentUser()
  const isIDIR = hasAnyRole(...govRoles)

  const paths = useMemo(
    () => [
      ROUTES.REPORTS.LIST,
      ROUTES.REPORTS.CHARGING_SITE.INDEX,
      ROUTES.REPORTS.MANAGE_FSE
    ],
    []
  )

  const tabIndex = useMemo(() => {
    // Map paths to the three tabs
    if (location.pathname.includes('/charging-sites')) return 1
    if (location.pathname.includes('/fse')) return 2

    if (
      location.pathname === ROUTES.REPORTS.LIST ||
      location.pathname === `${ROUTES.REPORTS.LIST}/`
    )
      return 0

    return 0
  }, [isIDIR, location.pathname])

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
    navigate(paths[newValue])
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

    // Default to compliance reports
    return <ComplianceReports />
  }

  return (
    <BCBox sx={{ bgcolor: 'background.paper' }}>
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
          <Tab
            label={t('tabs.complianceReporting')}
            wrapped
            {...a11yProps(0)}
          />
          {isIDIR ? (
            <Tab label={t('tabs.chargingSites')} {...a11yProps(1)} />
          ) : (
            <Tab label={t('tabs.manageChargingSites')} {...a11yProps(1)} />
          )}
          {isIDIR ? (
            <Tab label={t('tabs.fseIndex')} {...a11yProps(2)} />
          ) : (
            <Tab label={t('tabs.manageFSE')} {...a11yProps(2)} />
          )}
        </Tabs>
      </AppBar>
      <FloatingAlert ref={alertRef} data-test="alert-box" />
      <BCBox sx={{ pt: 3 }}>{renderContent()}</BCBox>
    </BCBox>
  )
}
