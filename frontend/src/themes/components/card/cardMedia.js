import borders from '@/themes/base/borders'
import { pxToRem } from '@/themes/utils'
const { borderRadius } = borders

const cardMedia = {
  styleOverrides: {
    root: {
      borderRadius: borderRadius.xl,
      margin: `${pxToRem(16)} ${pxToRem(16)} 0`
    },

    media: {
      width: 'auto'
    }
  }
}

export default cardMedia
