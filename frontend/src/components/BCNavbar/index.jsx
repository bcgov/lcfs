import { useState, useEffect } from 'react'
import { AppBar, Divider, useScrollTrigger } from '@mui/material'
import DefaultNavbarMobile from '@/components/BCNavbar/components/DefaultNavbarMobile'

// BCGov Dashboard React base styles
import breakpoints from '@/themes/base/breakpoints'
import { PropTypes } from 'prop-types'
import MenuBar from '@/components/BCNavbar/components/MenuBar'
import HeaderBar from '@/components/BCNavbar/components/HeaderBar'
import BCBox from '@/components/BCBox'

function BCNavbar(props) {
  const { routes } = props
  const isScrolled = useScrollTrigger()
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
          data={props}
          beta={props.beta}
          mobileView={mobileView}
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
          <MenuBar isScrolled={isScrolled} routes={routes} data={props} />
        )}
      </AppBar>
    </BCBox>
  )
}

BCNavbar.defaultProps = {
  title: 'Government of British Columbia',
  routes: [
    { icon: 'home', name: 'Dashboard', route: '/' }
    // Add other routes as needed
  ],
  beta: true,
  headerRightPart: null,
  menuRightPart: null
}

BCNavbar.propTypes = {
  title: PropTypes.string,
  routes: PropTypes.array.isRequired,
  beta: PropTypes.bool,
  headerRightPart: PropTypes.element,
  menuRightPart: PropTypes.element
}
export default BCNavbar
