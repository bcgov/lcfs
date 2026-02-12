// @mui material components
import Box from '@mui/material/Box'
import { styled } from '@mui/material/styles'

export type BCBoxVariant =
  | 'contained'
  | 'outlined'
  | 'bordered'
  | 'gradient'
  | 'success'
  | 'warning'
  | 'info'
  | 'error'
  | 'pending'

export type BCBoxColoredShadow =
  | 'primary'
  | 'secondary'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'light'
  | 'dark'
  | 'nav'
  | 'none'

interface BCBoxOwnerState {
  variant: BCBoxVariant
  bgColor: string
  color: string
  opacity: number
  borderRadius: string | number
  shadow: string
  coloredShadow: BCBoxColoredShadow
}

const BCBoxRoot = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'ownerState'
})<{ ownerState: BCBoxOwnerState }>(({ theme, ownerState }) => {
  const { palette, functions, borders, boxShadows } = theme as any
  const {
    variant,
    bgColor,
    color,
    opacity,
    borderRadius,
    shadow,
    coloredShadow
  } = ownerState

  const { alerts, gradients, grey, white, transparent } = palette
  const { linearGradient } = functions
  const { borderRadius: radius } = borders
  const { colored } = boxShadows

  const greyColors: Record<string, string> = {
    'grey-100': grey[100],
    'grey-200': grey[200],
    'grey-300': grey[300],
    'grey-400': grey[400],
    'grey-500': grey[500],
    'grey-600': grey[600],
    'grey-700': grey[700],
    'grey-800': grey[800],
    'grey-900': grey[900]
  }

  const validGradients = [
    'primary',
    'secondary',
    'info',
    'success',
    'warning',
    'error',
    'dark',
    'light',
    'nav'
  ]

  const validColors = [
    'transparent',
    'white',
    'black',
    'primary',
    'secondary',
    'info',
    'success',
    'warning',
    'error',
    'light',
    'nav',
    'dark',
    'text',
    'grey-100',
    'grey-200',
    'grey-300',
    'grey-400',
    'grey-500',
    'grey-600',
    'grey-700',
    'grey-800',
    'grey-900'
  ]

  const validBorderRadius = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl', 'section']
  const validBoxShadows = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl', 'inset']
  const alertVariants = ['success', 'info', 'warning', 'error', 'pending'] as const

  let boxShadowValue = 'none'

  if (validBoxShadows.includes(shadow)) {
    boxShadowValue = boxShadows[shadow]
  } else if (coloredShadow && colored[coloredShadow]) {
    boxShadowValue = colored[coloredShadow]
  }

  let colorValue = color

  if (validColors.includes(color)) {
    colorValue = palette[color] ? palette[color].main : greyColors[color]
  }

  let borderRadiusValue: string | number = borderRadius

  if (
    typeof borderRadius === 'string' &&
    validBorderRadius.includes(borderRadius)
  ) {
    borderRadiusValue = radius[borderRadius]
  }

  let backgroundValue = bgColor
  let borderValue = 'none'

  if (variant === 'gradient') {
    backgroundValue = validGradients.includes(bgColor)
      ? linearGradient(gradients[bgColor].main, gradients[bgColor].state)
      : white.main
  } else if (variant === 'outlined') {
    backgroundValue = white.main
    borderValue = `1.2px solid ${grey[500]}`
  } else if (variant === 'bordered') {
    backgroundValue = transparent.main
    borderValue = `1.3px solid ${grey[400]}`
    borderRadiusValue = '2px'
  } else if (
    alertVariants.includes(variant as (typeof alertVariants)[number])
  ) {
    const alertVariant = variant as keyof typeof alerts
    return {
      opacity,
      background: alerts[alertVariant].background,
      color: alerts[alertVariant].color,
      borderRadius: borderRadiusValue,
      boxShadow: boxShadowValue
    }
  } else if (validColors.includes(bgColor)) {
    backgroundValue = palette[bgColor]
      ? palette[bgColor].main
      : greyColors[bgColor]
  } else {
    backgroundValue = bgColor
  }

  return {
    opacity,
    background: backgroundValue,
    border: borderValue,
    color: colorValue,
    borderRadius: borderRadiusValue,
    boxShadow: boxShadowValue
  }
})
export default BCBoxRoot
