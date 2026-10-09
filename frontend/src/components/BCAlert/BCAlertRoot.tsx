// @mui material components
import Box from '@mui/material/Box'
import { styled } from '@mui/material/styles'

export type AlertSeverity = 'info' | 'success' | 'warning' | 'error' | 'pending'

export interface BCAlertTheme {
  palette: {
    gradients: Record<string, { main: string; state: string }>
    alerts: Record<
      AlertSeverity,
      { color: string; background: string; border?: string }
    >
  }
  typography: { fontSizeMD: string; fontWeightMedium: number }
  borders: { borderRadius: { md: string } }
  functions: {
    pxToRem: (value: number) => string
    linearGradient: (main: string, state: string) => string
  }
}

interface BCAlertOwnerState {
  color?: AlertSeverity | null
}

const BCAlertRoot = styled(Box)<{ ownerState: BCAlertOwnerState }>(
  ({ theme, ownerState }) => {
    const { palette, typography, borders, functions } =
      theme as unknown as BCAlertTheme
    const { color } = ownerState

    const { gradients, alerts } = palette
    const { fontSizeMD, fontWeightMedium } = typography
    const { borderRadius } = borders
    const { pxToRem, linearGradient } = functions

    const resolvedColor: AlertSeverity = color ?? 'info'

    // backgroundImage value
    const backgroundImageValue = alerts[resolvedColor].background
      ? linearGradient(
          alerts[resolvedColor].background,
          alerts[resolvedColor].background
        )
      : linearGradient(gradients.info.main, gradients.info.state)

    return {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      minHeight: pxToRem(40),
      backgroundImage: backgroundImageValue,
      color: alerts[resolvedColor].color,
      position: 'relative',
      padding: pxToRem(8),
      marginBottom: pxToRem(8),
      borderRadius: borderRadius.md,
      fontSize: fontSizeMD,
      fontWeight: fontWeightMedium
    }
  }
)

export default BCAlertRoot
