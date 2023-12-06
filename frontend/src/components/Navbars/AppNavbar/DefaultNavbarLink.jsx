import { useState } from 'react'
// prop-types is a library for typechecking of props
import PropTypes from 'prop-types'

// react-router-dom components
import { Link } from 'react-router-dom'

// @mui material components
import Icon from '@mui/material/Icon'

// Custom React components
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'

function DefaultNavbarLink({ icon, name, route, light }) {
  const [hover, setHover] = useState(false)
  return (
    <BCBox
      component={Link}
      to={route}
      mx={1}
      p={1}
      display="flex"
      alignItems="center"
      sx={({ transitions }) => ({
        cursor: 'pointer',
        userSelect: 'none',
        '&:hover': {
          backgroundColor: hover ? 'rgba(0, 0, 0, 0.1)' : 'transparent'
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
      <Icon
        sx={{
          color: ({ palette: { secondary, primary } }) =>
            light ? primary.main : secondary.main,
          verticalAlign: 'middle'
        }}
      >
        {icon}
      </Icon>
      <BCTypography
        variant="body2"
        fontWeight="light"
        color={light ? 'primary' : 'white'}
        textTransform="capitalize"
        sx={{ width: '100%', lineHeight: 0 }}
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
