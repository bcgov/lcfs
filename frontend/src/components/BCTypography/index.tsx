import { forwardRef, type ReactNode } from 'react'
import type { TypographyProps } from '@mui/material/Typography'

// Custom styles for BCTypography
import BCTypographyRoot from '@/components/BCTypography/BCTypographyRoot'

type BCTypographyColor =
  | 'inherit'
  | 'primary'
  | 'secondary'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'light'
  | 'dark'
  | 'text'
  | 'link'
  | 'white'

type BCTypographyFontWeight = false | 'light' | 'regular' | 'medium' | 'bold'

type BCTypographyTextTransform =
  | 'none'
  | 'capitalize'
  | 'uppercase'
  | 'lowercase'

type BCTypographyVerticalAlign =
  | 'unset'
  | 'baseline'
  | 'sub'
  | 'super'
  | 'text-top'
  | 'text-bottom'
  | 'middle'
  | 'top'
  | 'bottom'

interface BCTypographyProps extends Omit<TypographyProps, 'color' | 'children'> {
  color?: BCTypographyColor
  fontWeight?: BCTypographyFontWeight
  textTransform?: BCTypographyTextTransform
  verticalAlign?: BCTypographyVerticalAlign
  textGradient?: boolean
  opacity?: number
  children?: ReactNode
}

const BCTypography = forwardRef<HTMLElement, BCTypographyProps>(
  (
    {
      color = 'inherit',
      fontWeight = false,
      textTransform = 'none',
      verticalAlign = 'unset',
      textGradient = false,
      opacity = 1,
      children,
      ...rest
    },
    ref
  ) => {
    return (
      <BCTypographyRoot
        {...rest}
        ref={ref}
        ownerState={{
          color,
          textTransform,
          verticalAlign,
          fontWeight,
          opacity,
          textGradient
        }}
      >
        {children}
      </BCTypographyRoot>
    )
  }
)

BCTypography.displayName = 'BCTypography'

export default BCTypography
