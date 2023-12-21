import typography from '@/themes/base/typography'
import { pxToRem } from '@/themes/utils'

const { size } = typography

const dialogTitle = {
  styleOverrides: {
    root: {
      padding: pxToRem(16),
      fontSize: size.xl
    }
  }
}

export default dialogTitle
