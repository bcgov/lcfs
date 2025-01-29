import typography from '@/themes/base/typography'
import { pxToRem } from '@/themes/utils'
import colors from '@/themes/base/colors'

const { background, white } = colors
const { size } = typography

const dialogTitle = {
  styleOverrides: {
    root: {
      padding: pxToRem(16),
      fontSize: size.xl,
      backgroundColor: background.primary,
      border: 'none',
      color: white.main
    }
  }
}

export default dialogTitle
