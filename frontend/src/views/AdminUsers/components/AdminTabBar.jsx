// React components
import { useState, useEffect } from 'react'

// mui components
import { AppBar, Tab, Tabs } from '@mui/material'
import breakpoints from '@/themes/base/breakpoints'
import BCBox from '@/components/BCBox'
import { AdminTabPanel } from './AdminTablPanel'
import { Users } from './Users'
// Internal components

function a11yProps(index) {
  return {
    id: `full-width-tab-${index}`,
    'aria-controls': `full-width-tabpanel-${index}`
  }
}

export function AdminTabBar() {
  const [tabsOrientation, setTabsOrientation] = useState('horizontal')
  const [tabValue, setTabValue] = useState(0)

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

  const handleSetTabValue = (event, newValue) => setTabValue(newValue)

  return (
    <BCBox sx={{ bgcolor: 'background.paper' }}>
      <AppBar position="static" sx={{ boxShadow: 'none' }}>
        <Tabs
          sx={{ background: 'rgb(0, 0, 0, 0.08)', width: '60%' }}
          orientation={tabsOrientation}
          value={tabValue}
          aria-label="Tabs for selection of administration options"
          onChange={handleSetTabValue}
        >
          <Tab label="Users" wrapped {...a11yProps(0)} />
          <Tab label="Roles" {...a11yProps(1)} />
          <Tab label="User Activity" {...a11yProps(2)} />
          <Tab label="Fuel Codes" {...a11yProps(3)} />
          <Tab label="Compliance Reporting" {...a11yProps(4)} />
          <Tab label="Historical Data Entry" {...a11yProps(5)} />
        </Tabs>
      </AppBar>
      <AdminTabPanel value={tabValue} index={0} component="div">
        <Users />
      </AdminTabPanel>
    </BCBox>
  )
}
