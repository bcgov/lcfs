import { pxToRem } from '../utils'

import colors from '../base/colors'
import boxShadows from '../base/boxShadows'
import borders from '../base/borders'

const { transparent } = colors
const { lg } = boxShadows
const { borderRadius } = borders

const popover = {
  styleOverrides: {
    paper: {
      backgroundColor: transparent.main,
      boxShadow: lg,
      padding: pxToRem(8),
      borderRadius: borderRadius.md
    }
  }
}

export default popover
