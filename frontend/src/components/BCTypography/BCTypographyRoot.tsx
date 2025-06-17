// @mui material components
import Typography from '@mui/material/Typography'
import { styled } from '@mui/material/styles'

// Define the ownerState interface for BCTypography
interface BCTypographyOwnerState {
  color: string
  textTransform: string
  verticalAlign: string
  fontWeight: string | false
  opacity: number
  textGradient: boolean
}

const BCTypographyRoot = styled(Typography, {
  shouldForwardProp: (prop) => prop !== 'ownerState'
})<{ ownerState: BCTypographyOwnerState }>(({ theme, ownerState }) => {
  const { palette, typography, functions = {} } = theme as any
  const {
    color,
    textTransform,
    verticalAlign,
    fontWeight,
    opacity,
    textGradient
  } = ownerState

  const { gradients, transparent, white } = palette as any
  const {
    fontWeightLight,
    fontWeightRegular,
    fontWeightMedium,
    fontWeightBold
  } = typography
  const { linearGradient } = functions as any

  // fontWeight styles
  const fontWeights = {
    light: fontWeightLight,
    regular: fontWeightRegular,
    medium: fontWeightMedium,
    bold: fontWeightBold
  }

  // styles for the typography with textGradient={true}
  const gradientStyles = () => ({
    backgroundImage:
      color !== 'inherit' &&
      color !== 'text' &&
      color !== 'white' &&
      gradients[color]
        ? linearGradient(gradients[color].main, gradients[color].state)
        : linearGradient(gradients.dark.main, gradients.dark.state),
    display: 'inline-block',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: transparent.main,
    position: 'relative',
    zIndex: 1
  })

  // color value
  let colorValue =
    color === 'inherit' || !(palette as any)[color]
      ? 'inherit'
      : (palette as any)[color].main

  if (color === 'dark') colorValue = white.main

  return {
    opacity,
    textTransform,
    verticalAlign,
    textDecoration: 'none',
    color: colorValue,
    fontWeight:
      fontWeights[fontWeight as keyof typeof fontWeights] &&
      fontWeights[fontWeight as keyof typeof fontWeights],
    ...(textGradient && gradientStyles())
  } as any
})

export default BCTypographyRoot
