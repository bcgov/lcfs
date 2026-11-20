import type { Components, Theme } from '@mui/material/styles'
// @mui material components
import Zoom from '@mui/material/Zoom'

// base styles
import colors from '../base/colors'
import typography from '../base/typography'
import borders from '../base/borders'

import { pxToRem, rgba } from '../utils'

const { light, background } = colors
const { size, fontWeightRegular } = typography
const { borderRadius } = borders

const tooltip: NonNullable<Components<Theme>['MuiTooltip']> = {
  defaultProps: {
    arrow: true,
    TransitionComponent: Zoom
  },

  styleOverrides: {
    tooltip: {
      maxWidth: pxToRem(500),
      backgroundColor: rgba(background.primary, 0.9),
      color: light.main,
      fontSize: size.sm,
      fontWeight: fontWeightRegular,
      textAlign: 'center',
      borderRadius: borderRadius.md,
      padding: `${pxToRem(5)} ${pxToRem(8)} ${pxToRem(4)}`,
      textOverflow: 'ellipsis'
    },

    arrow: {
      color: background.primary
    }
  }
}

export default tooltip
