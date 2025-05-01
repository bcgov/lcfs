import { AppBar, Divider, Menu, useMediaQuery, useTheme } from '@mui/material'
import PopupState, { bindMenu } from 'material-ui-popup-state'
import DefaultNavbarLink from '@/components/BCNavbar/components/DefaultNavbarLink'
import { PropTypes } from 'prop-types'
import MenuBar from '@/components/BCNavbar/components/MenuBar'
import HeaderBar from '@/components/BCNavbar/components/HeaderBar'
import BCBox from '@/components/BCBox'

function BCNavbar({
  title = 'Government of British Columbia',
  routes = [
    { icon: 'home', name: 'Dashboard', route: '/' }
    // Add other routes as needed
  ],
  beta = true,
  headerRightPart = null,
  menuRightPart = null
}) {
  const theme = useTheme()
  const isMobileView = useMediaQuery(theme.breakpoints.down('xl'))

  return (
    <BCBox py={0} className="main-layout-navbar">
      <PopupState variant="popover" popupId="demo-popup-menu">
        {(popupState) => (
          <AppBar
            position="static"
            data-test="bc-navbar"
            component="nav"
            sx={{
              border: 'none',
              borderBottom: '5px solid',
              borderColor: '#dadada'
            }}
            color="inherit"
            elevation={0}
            aria-label="main navigation"
          >
            <HeaderBar
              data={{ title, routes, beta, headerRightPart, menuRightPart }}
              beta={beta}
              isMobileView={isMobileView}
              popupState={popupState}
            />
            <Divider
              orientation="vertical"
              flexItem
              sx={({ palette: { secondary } }) => ({
                backgroundColor: secondary.main,
                padding: '1px'
              })}
            />
            {isMobileView ? (
              <Menu
                px={0}
                {...bindMenu(popupState)}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'center'
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'left'
                }}
                sx={{ div: { minWidth: '300px' } }}
                MenuListProps={{ style: { minWidth: '300px' } }}
              >
                {routes.map(
                  (link) =>
                    !link.hide && (
                      <DefaultNavbarLink
                        key={link.name}
                        onClick={popupState.close}
                        icon={link.icon}
                        name={link.name}
                        route={link.route}
                        light={true}
                        isMobileView={isMobileView}
                      />
                    )
                )}
              </Menu>
            ) : (
              <MenuBar
                routes={routes}
                data={{ title, routes, beta, headerRightPart, menuRightPart }}
              />
            )}
          </AppBar>
        )}
      </PopupState>
    </BCBox>
  )
}

BCNavbar.propTypes = {
  title: PropTypes.string,
  routes: PropTypes.array.isRequired,
  beta: PropTypes.bool,
  headerRightPart: PropTypes.element,
  menuRightPart: PropTypes.element
}
export default BCNavbar
