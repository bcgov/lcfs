import { forwardRef } from 'react'

// prop-types is a library for typechecking of props
import PropTypes from 'prop-types'

// Custom styles for the BCBadge
import BCBadgeRoot from '@/components/BCBadge/BCBadgeRoot'

const BCBadge = forwardRef(
  (
    {
      color,
      variant,
      size,
      circular,
      indicator,
      border,
      container,
      children,
      ...rest
    },
    ref
  ) => (
    <BCBadgeRoot
      {...rest}
      ownerState={{
        color,
        variant,
        size,
        circular,
        indicator,
        border,
        container,
        children
      }}
      ref={ref}
      color="default"
    >
      {children}
    </BCBadgeRoot>
  )
)

BCBadge.displayName = 'BCBadge'

// Setting default values for the props of BCBadge
BCBadge.defaultProps = {
  color: 'info',
  variant: 'gradient',
  size: 'sm',
  circular: false,
  indicator: false,
  border: false,
  children: false,
  container: false
}

// Typechecking props of the BCBadge
BCBadge.propTypes = {
  color: PropTypes.oneOf([
    'primary',
    'secondary',
    'info',
    'success',
    'warning',
    'error',
    'light',
    'dark'
  ]),
  variant: PropTypes.oneOf(['gradient', 'contained', 'outlined']),
  size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg']),
  circular: PropTypes.bool,
  indicator: PropTypes.bool,
  border: PropTypes.bool,
  children: PropTypes.node,
  container: PropTypes.bool
}

export default BCBadge
