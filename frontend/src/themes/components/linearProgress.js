import borders from '../base/borders'
import colors from '../base/colors'
import { pxToRem } from '../utils'

const { borderRadius } = borders
const { light } = colors

const linearProgress = {
  styleOverrides: {
    root: {
      height: pxToRem(6),
      borderRadius: borderRadius.md
    },
    colorPrimary: {
      backgroundColor: light.main
    },
    colorSecondary: {
      backgroundColor: light.main
    },
    bar: {
      height: pxToRem(6),
      borderRadius: borderRadius.sm
    }
  }
}

export default linearProgress
