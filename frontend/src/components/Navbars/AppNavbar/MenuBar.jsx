import React from 'react'
import PropTypes from 'prop-types'

import { Divider, Toolbar } from '@mui/material';
import BCBox from 'components/BCBox';
import DefaultNavbarLink from 'components/Navbars/AppNavbar/DefaultNavbarLink';
import Logout from 'components/Navbars/AppNavbar/Logout';

const MenuBar = props => {
  const { isScrolled, routes } = props
  return (
    <Toolbar
      sx={({
        palette: { transparent: transparentColor, white, secondary },
        functions: { rgba },
      }) => ({
        backgroundColor: (isScrolled
          ? transparentColor.main
          : rgba(secondary.nav, 1)),
        backdropFilter: `saturate(200%) blur(30px)`,
        color: (isScrolled ? secondary.main : white.main),
        maxHeight: '40px',
        display: { xs: 'none', sm: 'flex' },
      })}
      disableGutters
      variant='dense'
    >
      <BCBox
        sx={{
          flexGrow: 1,
          display: { xs: 'none', sm: 'flex' },
          flexDirection: 'row',
          margin: 0,
          padding: 0,
        }}
      >
        {routes.map((route) => (
          <React.Fragment key={route.name}>
            <DefaultNavbarLink icon={route.icon} name={route.name} route={route.route} light={isScrolled} />
            <Divider orientation='vertical' variant='middle' flexItem sx={({ palette: { white } }) => ({ backgroundColor: white.main })} />
          </React.Fragment>
        ))}
      </BCBox >
      <BCBox display={{ xs: 'none', lg: 'flex' }} m={0} py={1} flexDirection='row'>
        <Logout isScrolled={isScrolled} />
      </BCBox>
    </Toolbar>
  )
}

MenuBar.propTypes = {
  isScrolled: PropTypes.bool,
  routes: PropTypes.array,
}

export default MenuBar