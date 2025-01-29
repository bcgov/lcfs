import typography from '@/themes/base/typography'
import borders from '@/themes/base/borders'
import colors from '@/themes/base/colors'
import { pxToRem } from '@/themes/utils'

const { size } = typography
const { text } = colors
const { borderWidth, borderColor } = borders

const dialogContent = {
  styleOverrides: {
    root: {
      padding: pxToRem(16),
      fontSize: size.md,
      color: text.main
    },

    dividers: {
      borderTop: `${borderWidth[2]} solid ${borderColor}`,
      borderBottom: `${borderWidth[2]} solid ${borderColor}`
    }
  }
}

export default dialogContent
