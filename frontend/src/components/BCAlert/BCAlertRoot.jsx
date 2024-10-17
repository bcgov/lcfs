// @mui material components
import Box from '@mui/material/Box'
import { styled } from '@mui/material/styles'

const BCAlertRoot = styled(Box)(({ theme, ownerState }) => {
  const { palette, typography, borders, functions } = theme
  const { color } = ownerState

  const { gradients, alerts } = palette
  const { fontSizeMD, fontWeightMedium } = typography
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
    minHeight: pxToRem(40),
    backgroundImage: backgroundImageValue,
    color: alerts[color].color,
    position: 'relative',
    padding: pxToRem(8),
    marginBottom: pxToRem(8),
    borderRadius: borderRadius.md,
    fontSize: fontSizeMD,
    fontWeight: fontWeightMedium
  }
})

export default BCAlertRoot
