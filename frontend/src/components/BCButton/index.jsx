import PropTypes from 'prop-types'
import { forwardRef } from 'react'
import BCButtonRoot from './BCButtonRoot'
import { CircularProgress } from '@mui/material'

const BCButton = forwardRef(
  ({ color, variant, size, circular, iconOnly, isLoading, children, ...rest }, ref) => {
    return (
      <BCButtonRoot
        {...rest}
        ref={ref}
        color="primary"
        variant={variant === 'gradient' ? 'contained' : variant}
        size={size}
        ownerState={{ color, variant, size, circular, iconOnly }}
      >
        {isLoading ? <CircularProgress size={22} color='white' /> : children}
      </BCButtonRoot>
    )
  }
)

BCButton.displayName = 'BCButton'

// Setting default values for the props of BCButton
BCButton.defaultProps = {
  size: 'medium',
  variant: 'contained',
  color: 'white',
  circular: false,
  iconOnly: false
}

// Typechecking props for the BCButton
BCButton.propTypes = {
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  variant: PropTypes.oneOf(['text', 'contained', 'outlined', 'gradient']),
  color: PropTypes.oneOf([
    'white',
    'primary',
    'secondary',
    'info',
    'success',
    'warning',
    'error',
    'light',
    'dark',
    'smoky'
  ]),
  circular: PropTypes.bool,
  iconOnly: PropTypes.bool,
  isLoading: PropTypes.bool,
  children: PropTypes.node.isRequired
}

export default BCButton
