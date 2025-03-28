import BCBox from '@/components/BCBox'
import { ROUTES } from '@/routes/routes'
import breakpoints from '@/themes/base/breakpoints'
import { NotificationTabPanel } from './components/NotificationTabPanel'
import { AppBar, Tab, Tabs } from '@mui/material'
import { PropTypes } from 'prop-types'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Notifications, NotificationSettings } from '.'

function a11yProps(index) {
  return {
    id: `full-width-tab-${index}`,
    'aria-controls': `full-width-notifications-tabs-${index}`
  }
}

export function NotificationMenu({ tabIndex }) {
  const { t } = useTranslation(['notifications'])
  const [tabsOrientation, setTabsOrientation] = useState('horizontal')
  const navigate = useNavigate()
  const paths = useMemo(() => [ROUTES.NOTIFICATIONS.LIST, ROUTES.NOTIFICATIONS.SETTINGS], [])

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
          sx={{ background: 'rgb(0, 0, 0, 0.08)', width: {md: '50%'} }}
          orientation={tabsOrientation}
          value={tabIndex}
          aria-label="Tabs for selection of notifications options"
          onChange={handleSetTabValue}
        >
          <Tab label={t('title.Notifications')} wrapped {...a11yProps(0)} />
          <Tab label={t('title.ConfigureNotifications')} {...a11yProps(1)} />
        </Tabs>
      </AppBar>
      <NotificationTabPanel value={tabIndex} index={0} component="div" mx={-3}>
        <Notifications />
      </NotificationTabPanel>
      <NotificationTabPanel value={tabIndex} index={1} component="div" mx={-3}>
        <NotificationSettings />
      </NotificationTabPanel>
    </BCBox>
  )
}

NotificationMenu.propTypes = {
  tabIndex: PropTypes.number.isRequired
}
