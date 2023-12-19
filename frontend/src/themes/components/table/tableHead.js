import borders from '@/themes/base/borders'
import { pxToRem } from '@/themes/utils'

const { borderRadius } = borders

const tableHead = {
  styleOverrides: {
    root: {
      // display: "block",
      padding: `${pxToRem(16)} ${pxToRem(16)} 0  ${pxToRem(16)}`,
      borderRadius: `${borderRadius.xl} ${borderRadius.xl} 0 0`
    }
  }
}

export default tableHead
