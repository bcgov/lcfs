import { useState } from 'react'
// prop-types is a library for typechecking of props
import PropTypes from 'prop-types'

// react-router-dom components
import { NavLink } from 'react-router-dom'

// @mui material components
import Icon from '@mui/material/Icon'

// Custom React components
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'

function DefaultNavbarLink({ icon, name, route, light }) {
  const [hover, setHover] = useState(false)
  return (
    <BCBox
      component={NavLink}
      className="NavLink"
      activeClassName="active"
      to={route}
      mx={1}
      p={1}
      display="flex"
      alignItems="center"
      sx={({ transitions, palette: { secondary, primary } }) => ({
        cursor: 'pointer',
        userSelect: 'none',
        minHeight: '2.5rem',
        paddingBottom: '14px',
        '&:hover': {
          backgroundColor: hover ? 'rgba(0, 0, 0, 0.3)' : 'transparent'
        },
        '&.active': {
          borderBottom: '3px solid #fcc219',
          backgroundColor: 'rgba(0, 0, 0, 0.3)'
        },
        transform: 'translateX(0)',
        transition: transitions.create('transform', {
          easing: transitions.easing.sharp,
          duration: transitions.duration.shorter
        })
      })}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {icon && (
        <Icon
          sx={{
            color: ({ palette: { secondary, primary } }) =>
              light ? primary.main : secondary.main,
            verticalAlign: 'middle'
          }}
        >
          {icon}
        </Icon>
      )}
      <BCTypography
        variant="body2"
        fontWeight="light"
        color={light ? 'primary' : 'white'}
        textTransform="capitalize"
        sx={{
          width: '100%',
          lineHeight: 0,
          '&:hover': {
            textDecoration: 'underline'
          }
        }}
      >
        &nbsp;{name}
      </BCTypography>
    </BCBox>
  )
}

// Typechecking props for the DefaultNavbarLink
DefaultNavbarLink.propTypes = {
  icon: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  route: PropTypes.string.isRequired,
  light: PropTypes.bool
}

export default DefaultNavbarLink
