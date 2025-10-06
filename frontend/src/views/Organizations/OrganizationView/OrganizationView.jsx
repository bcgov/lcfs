import React, { useState, useEffect, useMemo } from 'react'
import { useLocation, useNavigate, useParams, Outlet } from 'react-router-dom'
import { AppBar, Tab, Tabs } from '@mui/material'
import BCBox from '@/components/BCBox'
import BCAlert from '@/components/BCAlert'
import { OrganizationDetailsCard } from './OrganizationDetailsCard'
import { OrganizationUsers } from './OrganizationUsers'
import { CreditLedger } from './CreditLedger'
import CompanyOverview from './components/CompanyOverview'
import PenaltyLog from './components/PenaltyLog'
import SupplyHistory from './components/SupplyHistory'
import ComplianceTracking from './components/ComplianceTracking'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { roles } from '@/constants/roles'
import { useTranslation } from 'react-i18next'
import { ROUTES } from '@/routes/routes'

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
  const { t } = useTranslation(['org'])
  const [tabsOrientation, setTabsOrientation] = useState('horizontal')

  const location = useLocation()
  const navigate = useNavigate()
  const { orgID } = useParams()
  const [alert, setAlert] = useState(null)

  const { data: currentUser, hasRoles } = useCurrentUser()

  // Get the organization ID - either from URL params (IDIR users) or from current user (BCeID users)
  const organizationId = orgID ?? currentUser?.organization?.organizationId

  useEffect(() => {
    if (location.state?.message) {
      setAlert({
        message: location.state.message,
        severity: location.state.severity || 'info'
      })
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location, navigate])

  // Define tab paths following the wireframe order
  const tabPaths = useMemo(() => {
    const basePath = ROUTES.ORGANIZATIONS.VIEW.replace(':orgID', orgID || '')
    return [
      basePath,
      ROUTES.ORGANIZATIONS.USERS.replace(':orgID', orgID || ''),
      ROUTES.ORGANIZATIONS.CREDIT_LEDGER.replace(':orgID', orgID || ''),
      ROUTES.ORGANIZATIONS.COMPANY_OVERVIEW.replace(':orgID', orgID || ''),
      ROUTES.ORGANIZATIONS.PENALTY_LOG.replace(':orgID', orgID || ''),
      ROUTES.ORGANIZATIONS.SUPPLY_HISTORY.replace(':orgID', orgID || ''),
      ROUTES.ORGANIZATIONS.COMPLIANCE_TRACKING.replace(':orgID', orgID || '')
    ]
  }, [orgID])

  const tabLabels = [
    t('org:tabs.dashboard'),
    t('org:tabs.users'),
    t('org:tabs.creditLedger'),
    t('org:tabs.companyOverview'),
    t('org:tabs.penaltyLog'),
    t('org:tabs.supplyHistory'),
    t('org:tabs.complianceTracking')
  ]

  // Determine current tab index based on location
  const tabIndex = useMemo(() => {
    const currentPath = location.pathname
    const index = tabPaths.findIndex((path) => currentPath === path)
    return index >= 0 ? index : 0
  }, [location.pathname, tabPaths])

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

  const handleTabChange = (event, newValue) => {
    navigate(tabPaths[newValue])
  }

  // Render content based on current route
  const renderContent = () => {
    const currentPath = location.pathname || ''

    if (currentPath.includes('/users')) {
      return <OrganizationUsers />
    }
    if (currentPath.includes('/credit-ledger')) {
      return <CreditLedger organizationId={organizationId} />
    }
    if (currentPath.includes('/company-overview')) {
      return <CompanyOverview />
    }
    if (currentPath.includes('/penalty-log')) {
      return <PenaltyLog />
    }
    if (currentPath.includes('/supply-history')) {
      return <SupplyHistory organizationId={organizationId} />
    }
    if (currentPath.includes('/compliance-tracking')) {
      return <ComplianceTracking />
    }

    // Default to dashboard
    return <OrganizationDetailsCard addMode={addMode} />
  }

  return (
    <BCBox>
      {alert && (
        <BCAlert severity={alert.severity} sx={{ mb: 4 }}>
          {alert.message}
        </BCAlert>
      )}

      <BCBox sx={{ mt: 2, bgcolor: 'background.paper' }}>
        <AppBar position="static" sx={{ boxShadow: 'none', border: 'none' }}>
          <Tabs
            orientation={tabsOrientation}
            value={tabIndex}
            onChange={handleTabChange}
            aria-label="Organization tabs"
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              backgroundColor: 'rgba(0, 0, 0, 0.08)',
              width: 'fit-content',
              maxWidth: { xs: '100%', md: '100%', lg: '80%' },
              '& .MuiTab-root': {
                minWidth: 'auto',
                paddingX: 2,
                marginX: 1,
                whiteSpace: 'nowrap',
              },
              '& .MuiTabs-flexContainer': {
                flexWrap: 'nowrap'
              }
            }}
          >
            {tabLabels.map((label, idx) => (
              <Tab key={idx} label={label} />
            ))}
          </Tabs>
        </AppBar>

        <BCBox sx={{ pt: 3 }}>{renderContent()}</BCBox>
      </BCBox>
    </BCBox>
  )
}
