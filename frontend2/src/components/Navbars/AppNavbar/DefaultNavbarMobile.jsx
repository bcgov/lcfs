// prop-types is a library for typechecking of props.
import PropTypes from 'prop-types'

// @mui material components
import Menu from '@mui/material/Menu'

// Custom React components
import BCBox from '@/components/BCBox'

import DefaultNavbarLink from '@/components/Navbars/DefaultNavbar/DefaultNavbarLink'

function DefaultNavbarMobile ({ open, close, links, light }) {
  const { width } = open && open.getBoundingClientRect()

  return (
    <Menu
      getContentAnchorEl={null}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'center'
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'center'
      }}
      anchorEl={open}
      open={Boolean(open)}
      onClose={close}
      MenuListProps={{ style: { width: `calc(${width}px - 4rem)` } }}
    >
      <BCBox px={0.5}>
        {links.map((link) => (
          <DefaultNavbarLink key={link.name} icon={link.icon} name={link.name} route={link.route} light={light} />
        ))}
      </BCBox>
    </Menu>
  )
}

// Typechecking props for the DefaultNavbarMenu
DefaultNavbarMobile.propTypes = {
  open: PropTypes.oneOfType([PropTypes.bool, PropTypes.object]).isRequired,
  close: PropTypes.oneOfType([PropTypes.func, PropTypes.bool, PropTypes.object]).isRequired,
  links: PropTypes.arrayOf(PropTypes.object),
  light: PropTypes.bool
}

export default DefaultNavbarMobile
