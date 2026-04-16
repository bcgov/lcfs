import { forwardRef } from 'react'
import type { BoxProps } from '@mui/material/Box'

// Custom styles for BCBox
import BCBoxRoot, {
  type BCBoxVariant,
  type BCBoxColoredShadow
} from '@/components/BCBox/BCBoxRoot'

export interface BCBoxProps extends BoxProps {
  variant?: BCBoxVariant
  bgColor?: string
  color?: string
  opacity?: number
  borderRadius?: string | number
  shadow?: string
  coloredShadow?: BCBoxColoredShadow
  elevation?: number
  size?: number | string
  to?: string
}

const BCBox = forwardRef<HTMLDivElement, BCBoxProps>(
  (
    {
      variant = 'contained',
      bgColor = 'transparent',
      color = 'inherit',
      opacity = 1,
      borderRadius = 'none',
      shadow = 'none',
      coloredShadow = 'none',
      ...rest
    },
    ref
  ) => (
    <BCBoxRoot
      {...rest}
      ref={ref}
      ownerState={{
        variant,
        bgColor,
        color,
        opacity,
        borderRadius,
        shadow,
        coloredShadow
      }}
    />
  )
)

BCBox.displayName = 'BCBox'

export default BCBox
