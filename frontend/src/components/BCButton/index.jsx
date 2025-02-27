import PropTypes from 'prop-types'
import { forwardRef } from 'react'
import BCButtonRoot from './BCButtonRoot'
import { CircularProgress } from '@mui/material'

const BCButton = forwardRef(
  (
    {
      color = 'white',
      variant = 'contained',
      size = 'small',
      circular = false,
      iconOnly = false,
      isLoading,
      children,
      ...rest
    },
    ref
  ) => {
    return (
      <BCButtonRoot
        {...rest}
        ref={ref}
        color="primary"
        variant={variant === 'gradient' ? 'contained' : variant}
        size={size}
        ownerState={{ color, variant, size, circular, iconOnly }}
      >
        {isLoading ? (
          <CircularProgress
            size={22}
            color={variant === 'outlined' ? 'primary' : 'white'}
          />
        ) : (
          children
        )}
      </BCButtonRoot>
    )
  }
)

BCButton.displayName = 'BCButton'

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
