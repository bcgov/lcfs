import { useState, useEffect } from 'react'
import { AppBar, Box, Tab, Tabs } from '@mui/material'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import BCTypography from '@/components/BCTypography'
import { ROUTES } from '@/routes/routes'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { roles } from '@/constants/roles'
import { ComplianceReports } from '../ComplianceReports/ComplianceReports'
import { ChargingEquipment } from '../ChargingEquipment/ChargingEquipment'

function TabPanel({ children, value, index }) {
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`compliance-tabpanel-${index}`}
      aria-labelledby={`compliance-tab-${index}`}
      sx={{ pt: 3 }}
    >
      {value === index && children}
    </Box>
  )
}

export const ComplianceReporting = () => {
  const { t } = useTranslation(['common', 'reports', 'chargingEquipment'])
  const navigate = useNavigate()
  const location = useLocation()
  const { hasRoles, hasAnyRole } = useCurrentUser()
  
  const [searchParams, setSearchParams] = useSearchParams()
  const currentTab = searchParams.get('tab') || 'reports'
  const [tabsOrientation, setTabsOrientation] = useState('horizontal')

  // Tab configuration
  const tabs = [
    {
      id: 'reports',
      label: t('reports:title'),
      component: <ComplianceReports />,
      roles: [roles.government, roles.supplier]
    },
    {
      id: 'charging-sites',
      label: t('chargingEquipment:manageChargingSites'),
      component: <div>{t('chargingEquipment:chargingSitesComingSoon')}</div>,
      roles: [roles.supplier],
      disabled: true // Will enable when charging sites management is implemented
    },
    {
      id: 'manage-fse',
      label: t('chargingEquipment:manageFSE'),
      component: <ChargingEquipment />,
      roles: [roles.supplier]
    }
  ]

  // Filter tabs based on user roles
  const availableTabs = tabs.filter(tab => 
    hasAnyRole(...tab.roles) && !tab.disabled
  )

  const currentTabIndex = availableTabs.findIndex(tab => tab.id === currentTab)
  const validTabIndex = currentTabIndex >= 0 ? currentTabIndex : 0

  // Ensure URL has tab parameter
  useEffect(() => {
    const currentTabParam = searchParams.get('tab')
    
    if (!currentTabParam || !availableTabs.find(tab => tab.id === currentTabParam)) {
      const defaultTab = availableTabs[0]?.id || 'reports'
      const newSearchParams = new URLSearchParams(searchParams)
      newSearchParams.set('tab', defaultTab)
      setSearchParams(newSearchParams, { replace: true })
    }
  }, [searchParams, setSearchParams, availableTabs])

  // Handle responsive tabs
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth < 768) {
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
    const selectedTab = availableTabs[newValue]
    if (selectedTab) {
      const newSearchParams = new URLSearchParams(searchParams)
      newSearchParams.set('tab', selectedTab.id)
      setSearchParams(newSearchParams)
    }
  }

  return (
    <Box sx={{ width: '100%' }}>
      <BCTypography variant="h4" gutterBottom>
        {t('reports:title')}
      </BCTypography>
      
      <AppBar position="static" sx={{ bgcolor: 'transparent', boxShadow: 'none' }}>
        <Tabs
          value={validTabIndex}
          onChange={handleChangeTab}
          orientation={tabsOrientation}
          variant={tabsOrientation === 'vertical' ? 'fullWidth' : 'standard'}
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              minWidth: 120,
              fontWeight: 600
            },
            borderBottom: 1,
            borderColor: 'divider'
          }}
        >
          {availableTabs.map((tab, index) => (
            <Tab
              key={tab.id}
              label={tab.label}
              id={`compliance-tab-${index}`}
              aria-controls={`compliance-tabpanel-${index}`}
            />
          ))}
        </Tabs>
      </AppBar>

      {availableTabs.map((tab, index) => (
        <TabPanel key={tab.id} value={validTabIndex} index={index}>
          {tab.component}
        </TabPanel>
      ))}
    </Box>
  )
}