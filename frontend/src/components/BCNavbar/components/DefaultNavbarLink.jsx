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

function DefaultNavbarLink({ icon, name, route, light, onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <BCBox
      component={NavLink}
      className="NavLink"
      to={route}
      mx={1}
      mt={-0.1}
      mb={-1}
      py={1}
      px={2}
      display="flex"
      alignItems="center"
      sx={({ transitions }) => ({
        cursor: 'pointer',
        userSelect: 'none',
        minHeight: '2.7rem',
        paddingBottom: '15px',
        '&:hover': {
          borderBottom: '6px solid #38598a',
          backgroundColor: hover ? 'rgba(0, 0, 0, 0.3)' : 'transparent',
          paddingBottom: '9px',
        },
        '&.active': {
          borderBottom: '3px solid #fcc219',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          paddingBottom: '12px',
        },
        transform: 'translateX(0)',
        transition: transitions.create('transform', {
          easing: transitions.easing.sharp,
          duration: transitions.duration.shorter
        })
      })}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
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
        sx={{
          width: '100%',
          lineHeight: 0,
          '&:hover': {
            textDecoration: 'none'
          }
        }}
      >
        {name}
      </BCTypography>
    </BCBox>
  )
}

// Typechecking props for the DefaultNavbarLink
DefaultNavbarLink.propTypes = {
  icon: PropTypes.string,
  name: PropTypes.string.isRequired,
  route: PropTypes.string.isRequired,
  light: PropTypes.bool,
  onClick: PropTypes.func
}

export default DefaultNavbarLink
