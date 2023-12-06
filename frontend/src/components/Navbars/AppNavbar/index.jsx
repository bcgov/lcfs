import DefaultNavbarMobile from '@/components/Navbars/AppNavbar/DefaultNavbarMobile'
import { AppBar, Divider, useScrollTrigger } from '@mui/material'
import { useEffect, useState } from 'react'

// BCGov Dashboard React base styles
import breakpoints from '@/assets/theme/base/breakpoints'
import BCBox from '@/components/BCBox'
import HeaderBar from '@/components/Navbars/AppNavbar/HeaderBar'
import MenuBar from '@/components/Navbars/AppNavbar/MenuBar'
import { PropTypes } from 'prop-types'

// Nav Links
const routes = [
  { icon: 'home', name: 'Dashboard', route: '/' },
  { icon: 'folder', name: 'document', route: '/document' },
  { icon: 'account_balance', name: 'Transactions', route: '/transactions' },
  {
    icon: 'assessment',
    name: 'Compliance Report',
    route: '/compliance-report'
  },
  {
    icon: 'corporate_fare',
    name: 'Organization',
    route: '/organization/users/list'
  },
  {
    icon: 'admin_panel_settings',
    name: 'Administration',
    route: '/administration/users'
  }
]

function AppNavbar(props) {
  const [showBalance, setShowBalance] = useState(false)
  const isScrolled = useScrollTrigger()
  const toggleBalanceVisibility = () => {
    setShowBalance(!showBalance) // Toggles the visibility of the balance
  }
  const [mobileNavbar, setMobileNavbar] = useState(false)
  const [mobileView, setMobileView] = useState(false)
  const openMobileNavbar = ({ currentTarget }) =>
    setMobileNavbar(currentTarget.parentNode)
  const closeMobileNavbar = () => setMobileNavbar(false)

  useEffect(() => {
    // A function that sets the display state for the DefaultNavbarMobile.
    function displayMobileNavbar() {
      if (window.innerWidth < breakpoints.values.lg) {
        setMobileView(true)
        setMobileNavbar(false)
      } else {
        setMobileView(false)
        setMobileNavbar(false)
      }
    }

    /**
     The event listener that's calling the displayMobileNavbar function when
     resizing the window.
    */
    window.addEventListener('resize', displayMobileNavbar)
    // Call the displayMobileNavbar function to set the state with the initial value.
    displayMobileNavbar()

    // Remove event listener on cleanup
    return () => {
      window.removeEventListener('resize', displayMobileNavbar)
    }
  }, [])

  return (
    <BCBox py={0}>
      <AppBar
        postition="sticky"
        component="nav"
        color={isScrolled ? 'transparent' : 'inherit'}
        elevation={isScrolled ? 5 : 0}
      >
        <HeaderBar
          isScrolled={isScrolled}
          org={props}
          showBalance={showBalance}
          mobileView={mobileView}
          toggleBalanceVisibility={toggleBalanceVisibility}
          openMobileNavbar={openMobileNavbar}
          mobileNavbar={mobileNavbar}
        />
        <Divider
          orientation="vertical"
          flexItem
          sx={({ palette: { secondary } }) => ({
            backgroundColor: secondary.main,
            padding: '1px'
          })}
        />
        {mobileView ? (
          <DefaultNavbarMobile
            open={mobileNavbar}
            close={closeMobileNavbar}
            light={true}
            links={routes}
          />
        ) : (
          <MenuBar isScrolled={isScrolled} routes={routes} />
        )}
      </AppBar>
    </BCBox>
  )
}

AppNavbar.propTypes = {
  title: PropTypes.string,
  organizationName: PropTypes.string,
  balance: PropTypes.string
}
export default AppNavbar
