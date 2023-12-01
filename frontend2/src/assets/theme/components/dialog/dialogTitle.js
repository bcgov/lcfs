import typography from '@/assets/theme/base/typography'
import { pxToRem } from '@/assets/theme/utils'

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
