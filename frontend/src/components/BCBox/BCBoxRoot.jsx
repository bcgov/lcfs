// @mui material components
import Box from '@mui/material/Box'
import { styled } from '@mui/material/styles'

const BCBoxRoot = styled(Box)(({ theme, ownerState }) => {
  const { palette, functions, borders, boxShadows } = theme
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

  const greyColors = {
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
  const variants = ['success', 'info', 'warning', 'error']
  // boxShadow value
  let boxShadowValue = 'none'

  if (validBoxShadows.find((el) => el === shadow)) {
    boxShadowValue = boxShadows[shadow]
  } else if (coloredShadow) {
    boxShadowValue = colored[coloredShadow] ? colored[coloredShadow] : 'none'
  }

  // color value
  let colorValue = color

  if (validColors.find((el) => el === color)) {
    colorValue = palette[color] ? palette[color].main : greyColors[color]
  }

  // borderRadius value
  let borderRadiusValue = borderRadius

  if (validBorderRadius.find((el) => el === borderRadius)) {
    borderRadiusValue = radius[borderRadius]
  }

  // background value
  let backgroundValue = bgColor
  // border value
  let borderValue = 'none'

  if (variant === 'gradient') {
    backgroundValue = validGradients.find((el) => el === bgColor)
      ? linearGradient(gradients[bgColor].main, gradients[bgColor].state)
      : white.main
  } else if (variant === 'outlined') {
    backgroundValue = white.main
    borderValue = `1.2px solid ${grey[500]}`
  } else if (variant === 'bordered') {
    backgroundValue = transparent.main
    borderValue = `1.3px solid ${grey[400]}`
    borderRadiusValue = '2px'
  } else if (variants.includes(variant)) {
    return {
      opacity,
      background: alerts[variant].background,
      color: alerts[variant].color,
      borderRadius: borderRadiusValue,
      boxShadow: boxShadowValue
    }
  } else if (validColors.find((el) => el === bgColor)) {
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
