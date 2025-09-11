import BCBox from '@/components/BCBox'
import { ROUTES } from '@/routes/routes'
import breakpoints from '@/themes/base/breakpoints'
import { AppBar, Tab, Tabs } from '@mui/material'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useNavigate, useLocation, matchPath } from 'react-router-dom'
import { Role } from '@/components/Role'
import { roles } from '@/constants/roles'
import { ComplianceReports } from './ComplianceReports'
import { ChargingEquipment } from '@/views/ChargingEquipment'
import { FloatingAlert } from '@/components/BCAlert'

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

  const paths = useMemo(
    () => [
      ROUTES.REPORTS.LIST,
      `${ROUTES.REPORTS.LIST}/manage-charging-sites`,
      `${ROUTES.REPORTS.LIST}/manage-fse`
    ],
    []
  )

  const tabIndex = useMemo(() => {
    // Check for charging sites management routes
    if (location.pathname.includes('/manage-charging-sites')) {
      return 1
    }

    // Check for FSE management routes
    if (location.pathname.includes('/manage-fse')) {
      return 2
    }

    // Check if we're on the exact reports list path or index route
    if (
      location.pathname === ROUTES.REPORTS.LIST ||
      location.pathname === `${ROUTES.REPORTS.LIST}/`
    ) {
      return 0
    }

    // Default to compliance reports tab
    return 0
  }, [location.pathname])

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
    if (location.pathname.includes('/manage-charging-sites')) {
      return (
        <Role roles={[roles.supplier, roles.analyst]}>
          <Outlet alertRef={alertRef} />
        </Role>
      )
    }

    if (location.pathname.includes('/manage-fse')) {
      // Check if we're on a nested route (new or edit)
      if (location.pathname.includes('/new') || location.pathname.includes('/edit')) {
        return (
          <Role roles={[roles.supplier, roles.analyst]}>
            <Outlet alertRef={alertRef} />
          </Role>
        )
      }
      // Otherwise show the ChargingEquipment list
      return (
        <Role roles={[roles.supplier, roles.analyst]}>
          <ChargingEquipment alertRef={alertRef} />
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
          sx={{ background: 'rgb(0, 0, 0, 0.08)', width: '50%' }}
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
          <Tab label={t('tabs.manageChargingSites')} {...a11yProps(1)} />
          <Tab label={t('tabs.manageFSE')} {...a11yProps(2)} />
        </Tabs>
      </AppBar>
      <FloatingAlert ref={alertRef} data-test="alert-box" />
      <BCBox sx={{ pt: 3 }}>{renderContent()}</BCBox>
    </BCBox>
  )
}
