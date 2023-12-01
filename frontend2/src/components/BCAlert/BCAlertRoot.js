// @mui material components
import Box from '@mui/material/Box'
import { styled } from '@mui/material/styles'

export default styled(Box)(({ theme, ownerState }) => {
  const { palette, typography, borders, functions } = theme
  const { color } = ownerState

  const { gradients, alerts } = palette
  const { fontSizeRegular, fontWeightMedium } = typography
  const { borderRadius } = borders
  const { pxToRem, linearGradient } = functions

  // backgroundImage value
  const backgroundImageValue = alerts[color].background
    ? linearGradient(alerts[color].background, alerts[color].background)
    : linearGradient(gradients.info.main, gradients.info.state)

  return {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: pxToRem(60),
    backgroundImage: backgroundImageValue,
    color: alerts[color].color,
    position: 'relative',
    padding: pxToRem(16),
    marginBottom: pxToRem(16),
    borderRadius: borderRadius.md,
    fontSize: fontSizeRegular,
    fontWeight: fontWeightMedium
  }
})
