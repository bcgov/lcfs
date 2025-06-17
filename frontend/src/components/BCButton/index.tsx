import { forwardRef, ReactNode } from 'react'
import BCButtonRoot from './BCButtonRoot'
import { CircularProgress } from '@mui/material'

type BCButtonColor = 
  | 'white'
  | 'primary'
  | 'secondary'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'light'
  | 'dark'
  | 'smoky'

type BCButtonVariant = 'text' | 'contained' | 'outlined' | 'gradient'

type BCButtonSize = 'small' | 'medium' | 'large'

interface BCButtonProps {
  color?: BCButtonColor
  variant?: BCButtonVariant
  size?: BCButtonSize
  circular?: boolean
  iconOnly?: boolean
  isLoading?: boolean
  children: ReactNode
  [key: string]: any // For spreading additional props like onClick, disabled, etc.
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
        {...({ ownerState: { color, variant, size, circular, iconOnly } } as any)}
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