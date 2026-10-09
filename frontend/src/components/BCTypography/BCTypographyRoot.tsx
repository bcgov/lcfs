// @mui material components
import Typography from '@mui/material/Typography'
import { styled } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import type { CSSObject } from '@emotion/react'

interface BCTypographyTheme {
  palette: {
    gradients: Record<string, { main: string; state: string }>
    transparent: { main: string }
    white: { main: string }
  }
  typography: Theme['typography'] & {
    fontWeightLight: number
    fontWeightRegular: number
    fontWeightMedium: number
    fontWeightBold: number
  }
  functions?: {
    linearGradient?: (main: string, state: string) => string
  }
}

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
  const { palette, typography, functions = {} } =
    theme as unknown as BCTypographyTheme
  const {
    color,
    textTransform,
    verticalAlign,
    fontWeight,
    opacity,
    textGradient
  } = ownerState

  const { gradients, transparent, white } = palette
  const {
    fontWeightLight,
    fontWeightRegular,
    fontWeightMedium,
    fontWeightBold
  } = typography
  const { linearGradient } = functions
  const paletteColors = palette as unknown as Record<string, { main: string }>

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
    color === 'inherit' || !paletteColors[color]
      ? 'inherit'
      : paletteColors[color].main

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
  } as CSSObject
})

export default BCTypographyRoot
