import BCBox from '@/components/BCBox'
import DefaultNavbarLink from '@/components/BCNavbar/components/DefaultNavbarLink'
import { Divider, Toolbar } from '@mui/material'
import PropTypes from 'prop-types'
import React from 'react'

const MenuBar = (props) => {
  const { routes, data } = props
  return (
    <Toolbar
      className="nav"
      sx={({
        palette: { transparent: transparentColor, white, secondary },
        functions: { rgba }
      }) => ({
        backgroundColor: rgba(secondary.nav, 1),
        backdropFilter: `saturate(200%) blur(30px)`,
        color: white.main,
        maxHeight: '50px',
        display: { xs: 'none', sm: 'flex' }
      })}
      disableGutters
      variant="dense"
    >
      <BCBox
        sx={{
          flexGrow: 1,
          display: { xs: 'none', lg: 'flex' },
          flexDirection: 'row',
          margin: 0,
          padding: 0
        }}
      >
        {routes.map(
          (route, index) =>
            !route.hide && (
              <React.Fragment key={route.name}>
                <DefaultNavbarLink
                  icon={route.icon}
                  name={route.name}
                  route={route.route}
                  light={false}
                />
                {index !== routes.length - 1 && (
                  <Divider
                    orientation="vertical"
                    variant="middle"
                    flexItem
                    sx={({ palette: { secondary } }) => ({
                      backgroundColor: secondary.main
                    })}
                  />
                )}
              </React.Fragment>
            )
        )}
      </BCBox>
      <div className="animation start-home"></div>
      <BCBox
        display={{ xs: 'none', xl: 'flex' }}
        m={0}
        py={1}
        flexDirection="row"
      >
        {data.menuRightPart && React.cloneElement(data.menuRightPart, { data })}
      </BCBox>
    </Toolbar>
  )
}

MenuBar.propTypes = {
  routes: PropTypes.array
}

export default MenuBar
