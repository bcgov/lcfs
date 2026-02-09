import { forwardRef, type ReactNode } from 'react'
import type { BadgeProps } from '@mui/material/Badge'

// Custom styles for the BCBadge
import BCBadgeRoot, {
  type BCBadgeColor,
  type BCBadgeVariant,
  type BCBadgeSize
} from '@/components/BCBadge/BCBadgeRoot'

export interface BCBadgeProps
  extends Omit<BadgeProps, 'color' | 'variant' | 'children'> {
  color?: BCBadgeColor
  variant?: BCBadgeVariant
  size?: BCBadgeSize
  circular?: boolean
  indicator?: boolean
  border?: boolean
  container?: boolean
  children?: ReactNode
}

const BCBadge = forwardRef<HTMLSpanElement, BCBadgeProps>(
  (
    {
      color = 'info',
      variant = 'gradient',
      size = 'sm',
      circular = false,
      indicator = false,
      border = false,
      container = false,
      children = null,
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

export default BCBadge
