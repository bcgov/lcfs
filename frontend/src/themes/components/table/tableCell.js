import borders from '@/themes/base/borders'
import colors from '@/themes/base/colors'
import { pxToRem } from '@/themes/utils'

const { borderWidth } = borders
const { light } = colors

const tableCell = {
  styleOverrides: {
    root: {
      padding: `${pxToRem(12)} ${pxToRem(16)}`,
      borderBottom: `${borderWidth[1]} solid ${light.main}`
    }
  }
}

export default tableCell
