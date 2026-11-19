import type { Components, CSSObject, Theme } from '@mui/material/styles'

import root from './root'
import contained from './contained'
import outlined from './outlined'
import buttonText from './text'

type MuiButtonOverrides = NonNullable<Components<Theme>['MuiButton']>
type ButtonStyleOverrides = NonNullable<
  MuiButtonOverrides['styleOverrides']
> & {
  containedGlacier?: CSSObject
}

const button: Omit<MuiButtonOverrides, 'styleOverrides'> & {
  styleOverrides: ButtonStyleOverrides
} = {
  defaultProps: {
    disableRipple: false
  },
  styleOverrides: {
    root: { ...root },
    contained: { ...contained.base },
    containedSizeSmall: { ...contained.small },
    containedSizeLarge: { ...contained.large },
    containedPrimary: { ...contained.primary },
    containedSecondary: { ...contained.secondary },
    containedGlacier: { ...contained.glacier },
    outlined: { ...outlined.base },
    outlinedSizeSmall: { ...outlined.small },
    outlinedSizeLarge: { ...outlined.large },
    outlinedPrimary: { ...outlined.primary },
    outlinedSecondary: { ...outlined.secondary },
    text: { ...buttonText.base },
    textSizeSmall: { ...buttonText.small },
    textSizeLarge: { ...buttonText.large },
    textPrimary: { ...buttonText.primary },
    textSecondary: { ...buttonText.secondary }
  }
}

export default button
