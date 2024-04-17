import {
  AppBar,
  Divider,
  useMediaQuery,
  useTheme,
  Menu
} from '@mui/material'
import PopupState, { bindMenu } from 'material-ui-popup-state'
import DefaultNavbarLink from '@/components/BCNavbar/components/DefaultNavbarLink'

// BCGov Dashboard React base styles
import { PropTypes } from 'prop-types'
import MenuBar from '@/components/BCNavbar/components/MenuBar'
import HeaderBar from '@/components/BCNavbar/components/HeaderBar'
import BCBox from '@/components/BCBox'

function BCNavbar(props) {
  const { routes } = props
  const theme = useTheme()
  const isMobileView = useMediaQuery(theme.breakpoints.down('xl'))

  return (
    <BCBox py={0}>
      <PopupState variant="popover" popupId="demo-popup-menu">
        {(popupState) => (
          <AppBar
            position="static"
            data-test="bc-navbar"
            component="nav"
            sx={{ border: 'none' }}
            color="inherit"
            elevation={0}
          >
            <HeaderBar
              data={props}
              beta={props.beta}
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
                sx={{'div': {minWidth: '200px'}}}
                MenuListProps={{ style: { minWidth: '200px' } }}
              >
                {routes.map((link) => (
                  <DefaultNavbarLink
                    key={link.name}
                    onClick={popupState.close}
                    icon={link.icon}
                    name={link.name}
                    route={link.route}
                    light={true}
                  />
                ))}
              </Menu>
            ) : (
              <MenuBar routes={routes} data={props} />
            )}
          </AppBar>
        )}
      </PopupState>
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
