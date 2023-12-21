import boxShadows from '@/themes/base/boxShadows'
import typography from '@/themes/base/typography'
import colors from '@/themes/base/colors'
import borders from '@/themes/base/borders'
import { pxToRem } from '@/themes/utils'

const { lg } = boxShadows
const { size } = typography
const { text, white } = colors
const { borderRadius } = borders

const menu = {
  defaultProps: {
    disableAutoFocusItem: true
  },

  styleOverrides: {
    paper: {
      minWidth: pxToRem(160),
      boxShadow: lg,
      padding: `${pxToRem(16)} ${pxToRem(8)}`,
      fontSize: size.sm,
      color: text.main,
      textAlign: 'left',
      backgroundColor: `${white.main} !important`,
      borderRadius: borderRadius.md
    }
  }
}

export default menu
