import { PropTypes } from 'prop-types'
// React components
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
// mui components
import { AppBar, Tab, Tabs } from '@mui/material'
import breakpoints from '@/themes/base/breakpoints'
import BCBox from '@/components/BCBox'
import { AdminTabPanel } from '@/views/AdminMenu/components/AdminTabPanel'
import { Users } from './components/Users'
import { Roles } from './components/Roles'
import { ADMIN_ROLES, ADMIN_USERS } from '@/constants/routes/routes'

function a11yProps(index) {
  return {
    id: `full-width-tab-${index}`,
    'aria-controls': `full-width-tabpanel-${index}`
  }
}

export function AdminMenu({ tabIndex }) {
  const { t } = useTranslation(["admin"])
  const [tabsOrientation, setTabsOrientation] = useState('horizontal')
  const navigate = useNavigate()
  const paths = useMemo(() => [ADMIN_USERS, ADMIN_ROLES, '#', '#', '#', '#'])

  useEffect(() => {
    // A function that sets the orientation state of the tabs.
    function handleTabsOrientation() {
      return window.innerWidth < breakpoints.values.lg
        ? setTabsOrientation('vertical')
        : setTabsOrientation('horizontal')
    }

    // The event listener that's calling the handleTabsOrientation function when resizing the window.
    window.addEventListener('resize', handleTabsOrientation)

    // Call the handleTabsOrientation function to set the state with the initial value.
    handleTabsOrientation()

    // Remove event listener on cleanup
    return () => window.removeEventListener('resize', handleTabsOrientation)
  }, [tabsOrientation])

  const handleSetTabValue = (event, newValue) => {
    navigate(paths[newValue])
  }

  return (
    <BCBox sx={{ bgcolor: 'background.paper' }}>
      <AppBar position="static" sx={{ boxShadow: 'none', border: 'none' }}>
        <Tabs
          sx={{ background: 'rgb(0, 0, 0, 0.08)', width: '60%' }}
          orientation={tabsOrientation}
          value={tabIndex}
          aria-label="Tabs for selection of administration options"
          onChange={handleSetTabValue}
        >
          <Tab label={t('Users')} wrapped {...a11yProps(0)} />
          <Tab label={t('Roles')} {...a11yProps(1)} />
          <Tab label={t('UserActivity')} {...a11yProps(2)} />
          <Tab label={t('FuelCodes')} {...a11yProps(3)} />
          <Tab label={t('ComplianceReporting')} {...a11yProps(4)} />
          <Tab label={t('HistoricalDataEntry')} {...a11yProps(5)} />
        </Tabs>
      </AppBar>
      <AdminTabPanel value={tabIndex} index={0} component="div" mx={-3}>
        <Users />
      </AdminTabPanel>
      <AdminTabPanel value={tabIndex} index={1} component="div" mx={-3}>
        <Roles />
      </AdminTabPanel>
    </BCBox>
  )
}

AdminMenu.propTypes = {
  tabIndex: PropTypes.number.isRequired
}
