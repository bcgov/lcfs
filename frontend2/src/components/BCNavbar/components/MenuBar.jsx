import React from 'react'
import PropTypes from 'prop-types'

import { Divider, Toolbar } from '@mui/material'
import BCBox from '@/components/BCBox'
import DefaultNavbarLink from '@/components/BCNavbar/components/DefaultNavbarLink'
import colors from '@/assets/theme/base/colors'

const { transparent } = colors

const MenuBar = (props) => {
  const { isScrolled, routes, data } = props
  return (
    <Toolbar
      className="nav"
      sx={({ palette: { secondary, white }, functions: { rgba } }) => ({
        backgroundColor: isScrolled ? transparent.main : rgba(secondary.nav, 1),
        color: isScrolled ? secondary.main : white.main
      })}
      disableGutters
      variant="dense"
    >
      <BCBox
        sx={{
          flexGrow: 1,
          display: { xs: 'none', sm: 'flex' },
          flexDirection: 'row',
          margin: 0,
          padding: 0
        }}
      >
        {routes.map((route) => (
          <React.Fragment key={route.name}>
            <DefaultNavbarLink
              icon={route.icon}
              name={route.name}
              route={route.route}
              light={isScrolled}
            />
            <Divider
              orientation="vertical"
              variant="middle"
              flexItem
              sx={({ palette: { secondary } }) => ({
                backgroundColor: secondary.main
              })}
            />
          </React.Fragment>
        ))}
      </BCBox>
      <div className="animation start-home"></div>
      <BCBox
        display={{ xs: 'none', lg: 'flex' }}
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
  isScrolled: PropTypes.bool,
  routes: PropTypes.array
}

export default MenuBar
