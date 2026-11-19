import { forwardRef, type ReactNode } from 'react'
import type { ButtonProps } from '@mui/material/Button'
import BCButtonRoot from './BCButtonRoot'
import CircularProgress from '@mui/material/CircularProgress'

type BCButtonVariant = 'text' | 'contained' | 'outlined' | 'gradient'

type BCButtonSize = 'small' | 'medium' | 'large'

interface BCButtonProps extends Omit<
  ButtonProps,
  'color' | 'variant' | 'size'
> {
  color?: string
  variant?: BCButtonVariant
  size?: BCButtonSize
  circular?: boolean
  iconOnly?: boolean
  isLoading?: boolean
  children: ReactNode
}

const BCButton = forwardRef<HTMLButtonElement, BCButtonProps>(
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
            color={variant === 'outlined' ? 'primary' : 'inherit'}
          />
        ) : (
          children
        )}
      </BCButtonRoot>
    )
  }
)

BCButton.displayName = 'BCButton'

export default BCButton
