import colors from '@/themes/base/colors'
import borders from '@/themes/base/borders'
import boxShadows from '@/themes/base/boxShadows'

import { pxToRem, linearGradient } from '@/themes/utils'

const { transparent, gradients } = colors
const { borderRadius } = borders
const { colored } = boxShadows

const stepper = {
  styleOverrides: {
    root: {
      background: linearGradient(gradients.info.main, gradients.info.state),
      padding: `${pxToRem(24)} 0 ${pxToRem(16)}`,
      borderRadius: borderRadius.lg,
      boxShadow: colored.info,

      '&.MuiPaper-root': {
        backgroundColor: transparent.main
      }
    }
  }
}

export default stepper
