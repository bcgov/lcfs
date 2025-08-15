import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { AppBar, Tab, Tabs } from '@mui/material'
import BCBox from '@/components/BCBox'
import BCAlert from '@/components/BCAlert'
import { OrganizationDetailsCard } from './OrganizationDetailsCard'
import { OrganizationUsers } from './OrganizationUsers'
import { CreditLedger } from './CreditLedger'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { roles } from '@/constants/roles'
import { useTranslation } from 'react-i18next'

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
  const [tabIndex, setTabIndex] = useState(0)
  const [tabsOrientation, setTabsOrientation] = useState('horizontal')

  const location = useLocation()
  const navigate = useNavigate()
  const { orgID } = useParams()
  const [alert, setAlert] = useState(null)

  const { data: currentUser, hasRoles } = useCurrentUser()
  const isIdir = hasRoles(roles.government)

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

  const tabs = [
    { 
      label: t('org:dashboardTab', 'Dashboard'), 
      content: <OrganizationDetailsCard addMode={addMode}/> 
    },
    { 
      label: t('org:usersTab'), 
      content: <OrganizationUsers /> 
    },
    {
      label: t('org:creditLedgerTab'),
      content: <CreditLedger organizationId={organizationId} />
    }
  ]

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
    setTabIndex(newValue)
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
            onChange={handleChangeTab}
            aria-label="Organization tabs"
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

        {tabs.map((tab, idx) => (
          <TabPanel key={idx} value={tabIndex} index={idx}>
            {tab.content}
          </TabPanel>
        ))}
      </BCBox>
    </BCBox>
  )
}
