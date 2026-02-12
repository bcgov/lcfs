import { AppBar, Divider, Menu, useMediaQuery, useTheme } from '@mui/material'
import PopupState, { bindMenu } from 'material-ui-popup-state'
import type { PopupState as PopupStateType } from 'material-ui-popup-state/hooks'
import DefaultNavbarLink from '@/components/BCNavbar/components/DefaultNavbarLink'
import MenuBar from '@/components/BCNavbar/components/MenuBar'
import HeaderBar from '@/components/BCNavbar/components/HeaderBar'
import BCBox from '@/components/BCBox'
import type {
  BCNavbarProps,
  NavbarContextData,
  NavbarRoute
} from '@/components/BCNavbar/types'

const defaultRoutes: NavbarRoute[] = [
  { icon: 'home', name: 'Dashboard', route: '/' }
]

function BCNavbar({
  title = 'Government of British Columbia',
  routes = defaultRoutes,
  beta = true,
  headerRightPart = null,
  menuRightPart = null
}: BCNavbarProps) {
  const theme = useTheme()
  const isMobileView = useMediaQuery(theme.breakpoints.down('xl'))

  const navData: NavbarContextData = {
    title,
    routes,
    beta,
    headerRightPart,
    menuRightPart
  }

  return (
    <BCBox py={0} className="main-layout-navbar">
      <PopupState variant="popover" popupId="demo-popup-menu">
        {(popupState: PopupStateType) => (
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
              data={navData}
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
                        light
                        isMobileView={isMobileView}
                      />
                    )
                )}
              </Menu>
            ) : (
              <MenuBar routes={routes} data={navData} />
            )}
          </AppBar>
        )}
      </PopupState>
    </BCBox>
  )
}

export default BCNavbar
